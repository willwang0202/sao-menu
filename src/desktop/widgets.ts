import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import type { Settings } from '../shared/contracts';
import type { SocialSnapshot } from '../shared/social';
import { CLOCK_SIZE, MESSAGE_BUTTON_SIZE, unreadMessages, widgetPositions, type WidgetState } from '../shared/widgets';

type WidgetKind = 'clock' | 'message';
const SIZES: Record<WidgetKind, { width: number; height: number }> = { clock: CLOCK_SIZE, message: { width: MESSAGE_BUTTON_SIZE, height: MESSAGE_BUTTON_SIZE } };

/** Original SAO theme desktop widgets: the clock preset and the mail-style Message button. */
export class DesktopWidgets {
  private readonly windows = new Map<WidgetKind, BrowserWindow>();
  private readonly urls = new Map<WidgetKind, string>();
  private visible = false;
  constructor(private readonly renderer: string, private readonly settings: () => Settings, private readonly snapshot: () => SocialSnapshot | null, private readonly openMessages: () => void) {}
  async create(): Promise<void> {
    ipcMain.handle('sao:widget:state', event => { this.owner(event); return this.state(); });
    ipcMain.handle('sao:widget:messages', event => { if (this.owner(event) !== 'message') throw new Error('Only the Message button opens messages.'); this.openMessages(); });
    await Promise.all((['clock', 'message'] as WidgetKind[]).map(kind => this.createWindow(kind)));
    screen.on('display-metrics-changed', this.position); screen.on('display-added', this.position); screen.on('display-removed', this.position);
    this.position();
  }
  /** Widgets follow the HP display: shown after Link Start, hidden on hide. */
  show(): void { this.visible = true; this.refresh(); }
  hide(): void { this.visible = false; this.windows.forEach(window => { if (!window.isDestroyed()) window.hide(); }); }
  update(): void {
    const state = this.state();
    this.windows.forEach(window => { if (!window.isDestroyed()) window.webContents.send('sao:widget:update', state); });
    this.refresh();
  }
  stop(): void {
    screen.removeListener('display-metrics-changed', this.position); screen.removeListener('display-added', this.position); screen.removeListener('display-removed', this.position);
    ipcMain.removeHandler('sao:widget:state'); ipcMain.removeHandler('sao:widget:messages');
    this.windows.forEach(window => window.destroy()); this.windows.clear();
  }
  private shouldShow(kind: WidgetKind): boolean {
    const settings = this.settings();
    return this.visible && (kind === 'clock' ? settings.showClock : settings.showMessageButton && !!this.snapshot());
  }
  private refresh(): void {
    this.windows.forEach((window, kind) => {
      if (window.isDestroyed()) return;
      if (this.shouldShow(kind)) { if (!window.isVisible()) window.showInactive(); } else window.hide();
    });
  }
  private state(): WidgetState { return { unread: unreadMessages(this.snapshot()), reducedMotion: this.settings().reducedMotion }; }
  private owner(event: Electron.IpcMainInvokeEvent): WidgetKind {
    for (const [kind, window] of this.windows) {
      if (!window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === this.urls.get(kind)) return kind;
    }
    throw new Error('Untrusted widget sender.');
  }
  private async createWindow(kind: WidgetKind): Promise<void> {
    const url = new URL(this.renderer); url.searchParams.set('widget', kind); this.urls.set(kind, url.href);
    const window = new BrowserWindow({
      ...SIZES[kind], show: false, frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
      focusable: false, resizable: false, alwaysOnTop: true, skipTaskbar: true, title: kind === 'clock' ? 'SAO Clock' : 'SAO Message',
      webPreferences: { preload: path.join(__dirname, 'widget-preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
    });
    // The clock is display-only; clicks pass to the desktop below it.
    if (kind === 'clock') window.setIgnoreMouseEvents(true);
    if (process.platform === 'darwin') window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.on('page-title-updated', event => event.preventDefault());
    window.webContents.on('will-navigate', (event, destination) => { if (destination !== url.href) event.preventDefault(); });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    this.windows.set(kind, window);
    await window.loadURL(url.href);
  }
  private position = () => {
    const positions = widgetPositions(screen.getPrimaryDisplay().workArea);
    const clock = this.windows.get('clock'), message = this.windows.get('message');
    if (clock && !clock.isDestroyed()) clock.setPosition(positions.clock.x, positions.clock.y);
    if (message && !message.isDestroyed()) message.setPosition(positions.messageButton.x, positions.messageButton.y);
  };
}
