import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import type { Settings } from '../shared/contracts';
import type { SocialSnapshot } from '../shared/social';
import { INVITATION_SIZE, invitationPosition, isInvitationAnswer, pendingInvitation, type Invitation, type InvitationAnswer } from '../shared/invitations';
import { CONGRATULATIONS_SHOW_MS, CONGRATULATIONS_SIZE, congratulationsPosition } from '../shared/system-update';
import { CLOCK_SIZE, MESSAGE_BUTTON_SIZE, unreadMessages, widgetPositions, widgetStacking, type Celebration, type WidgetState } from '../shared/widgets';

type WidgetKind = 'clock' | 'message' | 'congratulations' | 'invitation';
const KINDS: WidgetKind[] = ['clock', 'message', 'congratulations', 'invitation'];
const SIZES: Record<WidgetKind, { width: number; height: number }> = { clock: CLOCK_SIZE, message: { width: MESSAGE_BUTTON_SIZE, height: MESSAGE_BUTTON_SIZE }, congratulations: CONGRATULATIONS_SIZE, invitation: INVITATION_SIZE };
const TITLES: Record<WidgetKind, string> = { clock: 'SAO Clock', message: 'SAO Message', congratulations: 'SAO Congratulations', invitation: 'SAO Invitation' };

/** Original SAO theme desktop widgets: the clock preset and the mail-style Message button. */
export class DesktopWidgets {
  private readonly windows = new Map<WidgetKind, BrowserWindow>();
  private readonly urls = new Map<WidgetKind, string>();
  private visible = false;
  private celebration: Celebration | null = null;
  private pendingCelebration: string | null = null;
  private celebrationTimer: NodeJS.Timeout | null = null;
  private celebrations = 0;
  constructor(private readonly renderer: string, private readonly settings: () => Settings, private readonly snapshot: () => SocialSnapshot | null, private readonly openMessages: () => void, private readonly answerInvitation: (invitation: Invitation, answer: InvitationAnswer) => Promise<void>) {}
  async create(): Promise<void> {
    ipcMain.handle('sao:widget:state', event => { this.owner(event); return this.state(); });
    ipcMain.handle('sao:widget:messages', event => { if (this.owner(event) !== 'message') throw new Error('Only the Message button opens messages.'); this.openMessages(); });
    ipcMain.handle('sao:widget:answer', (event, id: unknown, answer: unknown) => {
      if (this.owner(event) !== 'invitation') throw new Error('Only the invitation window answers invitations.');
      const invitation = pendingInvitation(this.snapshot());
      if (!invitation || invitation.id !== id || !isInvitationAnswer(answer)) throw new Error('This invitation is no longer waiting for an answer.');
      return this.answerInvitation(invitation, answer);
    });
    await Promise.all(KINDS.map(kind => this.createWindow(kind)));
    screen.on('display-metrics-changed', this.position); screen.on('display-added', this.position); screen.on('display-removed', this.position);
    this.position();
  }
  /** Widgets follow the HP display: shown after Link Start, hidden on hide. */
  show(): void {
    this.visible = true; this.refresh();
    if (this.pendingCelebration) { const label = this.pendingCelebration; this.pendingCelebration = null; this.celebrate(label); }
  }
  /** Plays the Congratulations!! banner once; waits for Link Start to finish if needed. */
  celebrate(label: string): void {
    if (!this.visible) { this.pendingCelebration = label; return; }
    if (this.celebrationTimer) clearTimeout(this.celebrationTimer);
    this.celebration = { id: ++this.celebrations, label };
    this.update();
    this.celebrationTimer = setTimeout(() => { this.celebrationTimer = null; this.celebration = null; this.update(); }, CONGRATULATIONS_SHOW_MS);
  }
  raise(): void { this.windows.forEach(window => { if (!window.isDestroyed() && window.isVisible()) window.moveTop(); }); }
  hide(): void { this.visible = false; this.windows.forEach(window => { if (!window.isDestroyed()) window.hide(); }); }
  update(): void {
    const state = this.state();
    this.windows.forEach(window => { if (!window.isDestroyed()) window.webContents.send('sao:widget:update', state); });
    this.refresh();
  }
  stop(): void {
    screen.removeListener('display-metrics-changed', this.position); screen.removeListener('display-added', this.position); screen.removeListener('display-removed', this.position);
    ipcMain.removeHandler('sao:widget:state'); ipcMain.removeHandler('sao:widget:messages'); ipcMain.removeHandler('sao:widget:answer');
    if (this.celebrationTimer) clearTimeout(this.celebrationTimer);
    this.windows.forEach(window => window.destroy()); this.windows.clear();
  }
  private shouldShow(kind: WidgetKind): boolean {
    const settings = this.settings();
    // The Message button appears only while there are unread messages.
    if (!this.visible) return false;
    if (kind === 'clock') return settings.showClock;
    if (kind === 'congratulations') return this.celebration !== null;
    if (kind === 'invitation') return pendingInvitation(this.snapshot()) !== null;
    return settings.showMessageButton && unreadMessages(this.snapshot()) > 0;
  }
  private refresh(): void {
    this.windows.forEach((window, kind) => {
      if (window.isDestroyed()) return;
      const stacking = widgetStacking(this.settings().alwaysOnTop); window.setAlwaysOnTop(stacking.isAlwaysOnTop, stacking.level);
      if (this.shouldShow(kind)) { if (!window.isVisible()) { window.showInactive(); window.moveTop(); } } else window.hide();
    });
  }
  private state(): WidgetState {
    const settings = this.settings();
    return { unread: unreadMessages(this.snapshot()), reducedMotion: settings.reducedMotion, sound: settings.sound, theme: settings.theme, celebration: this.celebration, invitation: pendingInvitation(this.snapshot()) };
  }
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
      focusable: kind === 'invitation', resizable: false, skipTaskbar: true, title: TITLES[kind],
      webPreferences: { preload: path.join(__dirname, 'widget-preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
    });
    // The clock and banner are display-only; clicks pass to the desktop below them.
    if (kind === 'clock' || kind === 'congratulations') window.setIgnoreMouseEvents(true);
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
    const clock = this.windows.get('clock'), message = this.windows.get('message'), banner = this.windows.get('congratulations');
    const invitation = this.windows.get('invitation');
    if (invitation && !invitation.isDestroyed()) { const place = invitationPosition(screen.getPrimaryDisplay().workArea); invitation.setPosition(place.x, place.y); }
    if (banner && !banner.isDestroyed()) { const place = congratulationsPosition(screen.getPrimaryDisplay().workArea); banner.setPosition(place.x, place.y); }
    if (clock && !clock.isDestroyed()) clock.setPosition(positions.clock.x, positions.clock.y);
    if (message && !message.isDestroyed()) message.setPosition(positions.messageButton.x, positions.messageButton.y);
  };
}
