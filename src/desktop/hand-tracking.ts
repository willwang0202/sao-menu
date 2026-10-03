import { BrowserWindow, ipcMain, systemPreferences, type IpcMainEvent, type WebContents } from 'electron';
import { allowsCameraRequest, parseTrackerEvent, TRACKER_FPS, type TrackerConfig, type TrackerEvent } from '../shared/hand/protocol';
import type { HandTrackingStatus, Position } from '../shared/contracts';

const RESTART_DELAYS_MS = [1000, 3000, 9000] as const;
const DROPPED_MESSAGE_LOG_INTERVAL = 100;
const DEBUG_SIZE = { width: 640, height: 480 } as const;
const DENIED_MESSAGE = 'Camera access is off for SAO Utils 2. Allow it in System Settings → Privacy & Security → Camera, then turn hand gestures on again.';
const UNDECIDED_MESSAGE = 'Camera access has not been granted yet. Turn hand gestures off and on again to allow it.';

export interface HandTrackingHandlers {
  summon(point: Position): void;
  dismiss(): void;
  cursor(point: Position, visible: boolean): void;
  click(point: Position): void;
}

/** Owns the hidden camera page. Only validated, derived gesture events leave it. */
export class HandTrackingController {
  private window: BrowserWindow | null = null;
  private enabled = false;
  private menuOpen = false;
  private restarts = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private dropped = 0;
  private status: HandTrackingStatus = {
    supported: true, enabled: false, permission: 'unknown', running: false,
    message: 'Turn on hand gestures to control the launcher with your camera.',
  };

  constructor(
    private readonly trackerURL: string,
    private readonly preload: string,
    private readonly handlers: HandTrackingHandlers,
    private readonly isDebug = false,
  ) {
    ipcMain.on('sao:tracker:event', this.receive);
  }

  getStatus(): HandTrackingStatus {
    return { ...this.status, permission: this.cameraPermission() };
  }

  /** Allows the tracker's own camera request; every other permission stays denied. */
  allowsPermission(contents: WebContents | null, permission: string, details: { mediaTypes?: string[]; mediaType?: string }): boolean {
    const isTracker = !!contents && !!this.window && !this.window.isDestroyed() && contents === this.window.webContents;
    return allowsCameraRequest({ isTracker, permission, mediaTypes: details.mediaTypes, mediaType: details.mediaType });
  }

  /** Starts tracking. Prompts for camera access only when `shouldPrompt` (an explicit user action). */
  async enable(shouldPrompt: boolean): Promise<void> {
    const permission = this.cameraPermission();
    const isGranted = permission === 'granted' || (shouldPrompt && permission === 'unknown' && await this.askCamera());
    if (!isGranted) {
      this.update({ enabled: false, running: false, message: permission === 'unknown' && !shouldPrompt ? UNDECIDED_MESSAGE : DENIED_MESSAGE });
      if (shouldPrompt) throw new Error(DENIED_MESSAGE);
      return;
    }
    this.enabled = true;
    this.restarts = 0;
    this.update({ enabled: true, message: 'Starting the camera…' });
    await this.open();
  }

  disable(): void {
    this.enabled = false;
    this.close();
    this.update({ enabled: false, running: false, message: 'Hand gestures are off. The camera is not in use.' });
  }

  setMenuOpen(open: boolean): void {
    this.menuOpen = open;
    this.sendConfig();
  }

  stop(): void {
    ipcMain.removeListener('sao:tracker:event', this.receive);
    this.enabled = false;
    this.close();
  }

  private cameraPermission(): HandTrackingStatus['permission'] {
    if (process.platform !== 'darwin' && process.platform !== 'win32') return 'granted';
    const access = systemPreferences.getMediaAccessStatus('camera');
    if (access === 'granted') return 'granted';
    return access === 'denied' || access === 'restricted' ? 'denied' : 'unknown';
  }

  private async askCamera(): Promise<boolean> {
    return process.platform === 'darwin' ? systemPreferences.askForMediaAccess('camera') : true;
  }

  private async open(): Promise<void> {
    this.close();
    const url = new URL(this.trackerURL);
    if (this.isDebug) url.searchParams.set('debug', '1');
    const window = this.window = new BrowserWindow({
      ...DEBUG_SIZE, show: this.isDebug, title: 'SAO Hand Tracker', skipTaskbar: !this.isDebug, focusable: this.isDebug,
      webPreferences: {
        preload: this.preload, nodeIntegration: false, contextIsolation: true, sandbox: true,
        webSecurity: true, backgroundThrottling: false,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.on('render-process-gone', (_event, details) => this.crashed(details.reason));
    window.webContents.once('did-finish-load', () => this.sendConfig());
    await window.loadURL(url.href);
  }

  private close(): void {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
    this.window = null;
    this.handlers.cursor({ x: 0, y: 0 }, false);
  }

  private crashed(reason: string): void {
    this.close();
    this.update({ running: false });
    if (!this.enabled) return;
    const delay = RESTART_DELAYS_MS[this.restarts];
    if (delay === undefined) {
      this.enabled = false;
      this.update({ enabled: false, message: `Hand tracking stopped after repeated failures (${reason}). Turn it on again to retry.` });
      return;
    }
    this.restarts += 1;
    this.update({ message: `Hand tracking stopped (${reason}); restarting…` });
    this.restartTimer = setTimeout(() => { void this.open().catch(error => this.fail(error)); }, delay);
  }

  private fail(error: unknown): void {
    this.enabled = false;
    this.close();
    this.update({ enabled: false, running: false, message: error instanceof Error ? error.message : String(error) });
  }

  private sendConfig(): void {
    if (!this.window || this.window.isDestroyed()) return;
    const config: TrackerConfig = { fps: this.menuOpen ? TRACKER_FPS.active : TRACKER_FPS.idle, menuOpen: this.menuOpen };
    this.window.webContents.send('sao:tracker:config', config);
  }

  private isTrackerSender(event: IpcMainEvent): boolean {
    const window = this.window;
    if (!window || window.isDestroyed() || event.sender !== window.webContents) return false;
    const frame = event.senderFrame;
    if (!frame || frame !== window.webContents.mainFrame) return false;
    try {
      const actual = new URL(frame.url);
      const expected = new URL(this.trackerURL);
      return actual.origin === expected.origin && actual.pathname === expected.pathname;
    } catch {
      return false;
    }
  }

  private receive = (event: IpcMainEvent, payload: unknown): void => {
    if (!this.isTrackerSender(event)) return;
    const message = parseTrackerEvent(payload);
    if (!message) {
      this.dropped += 1;
      if (this.dropped % DROPPED_MESSAGE_LOG_INTERVAL === 1) console.warn(`Dropped ${this.dropped} malformed hand-tracker message(s).`);
      return;
    }
    this.route(message);
  };

  private route(message: TrackerEvent): void {
    switch (message.kind) {
      case 'status':
        if (message.state === 'error') { this.fail(new Error(message.message ?? 'Hand tracking stopped.')); return; }
        if (message.state === 'running') this.restarts = 0;
        this.update({ running: message.state === 'running', message: message.state === 'running'
          ? 'Two fingers, swipe down to open · point to aim · push to select · open hand, swipe sideways to close.'
          : 'Starting the camera…' });
        return;
      case 'summon': this.handlers.summon({ x: message.x, y: message.y }); return;
      case 'dismiss': this.handlers.dismiss(); return;
      case 'cursor': this.handlers.cursor({ x: message.x, y: message.y }, message.visible); return;
      case 'click': this.handlers.click({ x: message.x, y: message.y }); return;
    }
  }

  private update(change: Partial<HandTrackingStatus>): void {
    this.status = { ...this.status, ...change };
  }
}
