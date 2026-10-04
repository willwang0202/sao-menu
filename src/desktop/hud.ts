import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import { hpState, hpHeight, type HpState } from '../shared/hud';
import type { SocialSnapshot } from '../shared/social';
import type { Settings } from '../shared/contracts';
import { getSystemStats } from './system';
import { widgetStacking } from '../shared/widgets';

/** Persistent source HP widget, independent of the summoned launcher. */
export class HpDisplay {
  private window: BrowserWindow | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: HpState = { theme: 'sao', playerName: 'Kirito', reducedMotion: false, stats: null, partyMembers: [] };
  private sampling = false;
  private isAlwaysOnTop: boolean | null = null;
  private width = 358;
  constructor(private readonly renderer: string, private readonly settings: () => Settings, private readonly snapshot: () => SocialSnapshot | null) {}
  async create(): Promise<void> {
    const url = new URL(this.renderer); url.searchParams.set('hp', '1');
    const area = screen.getPrimaryDisplay().workArea;
    const window = this.window = new BrowserWindow({
      x: area.x + 24, y: area.y + 24, width: 358, height: 62,
      show: false, frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
      focusable: false, resizable: false, skipTaskbar: true, title: 'SAO HP Display',
      webPreferences: { preload: path.join(__dirname, 'hud-preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
    });
    window.setIgnoreMouseEvents(true);
    this.applyStacking();
    if (process.platform === 'darwin') window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.on('page-title-updated', event => event.preventDefault());
    window.webContents.on('will-navigate', (event, destination) => { if (destination !== url.href) event.preventDefault(); });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    const owner = (event: Electron.IpcMainInvokeEvent) => {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== url.href) throw new Error('Untrusted HP display sender.');
    };
    ipcMain.handle('sao:hp:state', event => { owner(event); return this.state; });
    ipcMain.handle('sao:hp:width', (event, width) => {
      owner(event);
      if (typeof width !== 'number' || !Number.isFinite(width) || width < 358 || width > 2048) throw new Error('Invalid HP display width.');
      this.width = Math.ceil(width);
      window.setSize(this.width, hpHeight(this.state.partyMembers.length, this.state.theme));
    });
    screen.on('display-metrics-changed', this.position);
    screen.on('display-added', this.position); screen.on('display-removed', this.position);
    await this.sample(); await window.loadURL(url.href);
    this.timer = setInterval(() => { void this.sample(); }, 1000); this.timer.unref();
  }
  show(): void { if (this.window && !this.window.isDestroyed()) { this.window.showInactive(); this.window.moveTop(); } }
  raise(): void { if (this.window && !this.window.isDestroyed() && this.window.isVisible()) this.window.moveTop(); }
  private applyStacking(): void {
    if (!this.window || this.window.isDestroyed()) return;
    const stacking = widgetStacking(this.settings().alwaysOnTop);
    if (stacking.isAlwaysOnTop === this.isAlwaysOnTop) return;
    this.isAlwaysOnTop = stacking.isAlwaysOnTop; this.window.setAlwaysOnTop(stacking.isAlwaysOnTop, stacking.level);
  }
  hide(): void { if (this.window && !this.window.isDestroyed()) this.window.hide(); }
  update(): void {
    this.state = hpState(this.settings(), this.state.stats, this.snapshot());
    this.applyStacking();
    if (this.window && !this.window.isDestroyed()) {
      const height = hpHeight(this.state.partyMembers.length, this.state.theme);
      if (this.window.getSize()[1] !== height) this.window.setSize(this.width, height);
      this.window.webContents.send('sao:hp:update', this.state);
    }
  }
  private position = () => {
    if (!this.window || this.window.isDestroyed()) return;
    const area = screen.getPrimaryDisplay().workArea; this.window.setPosition(area.x + 24, area.y + 24);
  };
  private async sample(): Promise<void> {
    if (this.sampling) return; this.sampling = true;
    try {
      this.state.stats = await getSystemStats(); this.update();
    } catch (error) { console.warn('HP statistics unavailable', error); }
    finally { this.sampling = false; }
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    screen.removeListener('display-metrics-changed', this.position); screen.removeListener('display-added', this.position); screen.removeListener('display-removed', this.position);
    ipcMain.removeHandler('sao:hp:state'); ipcMain.removeHandler('sao:hp:width'); this.window?.destroy(); this.window = null;
  }
}
