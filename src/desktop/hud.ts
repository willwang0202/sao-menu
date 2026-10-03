import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import type { HpState } from '../shared/hud';
import type { Settings } from '../shared/contracts';
import { getSystemStats } from './system';

/** Persistent source HP widget, independent of the summoned launcher. */
export class HpDisplay {
  private window: BrowserWindow | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: HpState = { playerName: 'Kirito', reducedMotion: false, stats: null };
  private sampling = false;
  constructor(private readonly renderer: string, private readonly settings: () => Settings) {}
  async create(): Promise<void> {
    const url = new URL(this.renderer); url.searchParams.set('hp', '1');
    const area = screen.getPrimaryDisplay().workArea;
    const window = this.window = new BrowserWindow({
      x: area.x + 24, y: area.y + 24, width: 358, height: 89,
      show: false, frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
      focusable: false, resizable: false, alwaysOnTop: true, skipTaskbar: true, title: 'SAO HP Display',
      webPreferences: { preload: path.join(__dirname, 'hud-preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
    });
    window.setIgnoreMouseEvents(true);
    if (process.platform === 'darwin') window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.on('page-title-updated', event => event.preventDefault());
    window.webContents.on('will-navigate', (event, destination) => { if (destination !== url.href) event.preventDefault(); });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    ipcMain.handle('sao:hp:state', event => {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== url.href) throw new Error('Untrusted HP display sender.');
      return this.state;
    });
    screen.on('display-metrics-changed', this.position);
    screen.on('display-added', this.position); screen.on('display-removed', this.position);
    await this.sample(); await window.loadURL(url.href);
    this.timer = setInterval(() => { void this.sample(); }, 1000); this.timer.unref();
  }
  show(): void { if (this.window && !this.window.isDestroyed()) this.window.showInactive(); }
  hide(): void { if (this.window && !this.window.isDestroyed()) this.window.hide(); }
  private position = () => {
    if (!this.window || this.window.isDestroyed()) return;
    const area = screen.getPrimaryDisplay().workArea; this.window.setPosition(area.x + 24, area.y + 24);
  };
  private async sample(): Promise<void> {
    if (this.sampling) return; this.sampling = true;
    try {
      const stats = await getSystemStats(), settings = this.settings();
      this.state = { stats, playerName: settings.playerName, reducedMotion: settings.reducedMotion };
      if (this.window && !this.window.isDestroyed()) this.window.webContents.send('sao:hp:update', this.state);
    } catch (error) { console.warn('HP statistics unavailable', error); }
    finally { this.sampling = false; }
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    screen.removeListener('display-metrics-changed', this.position); screen.removeListener('display-added', this.position); screen.removeListener('display-removed', this.position);
    ipcMain.removeHandler('sao:hp:state'); this.window?.destroy(); this.window = null;
  }
}
