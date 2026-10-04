import type { EventEmitter } from 'node:events';
import type { UpdateCapability, UpdateStatus } from '../shared/contracts';

export const RELEASE_PAGE = 'https://github.com/willwang0202/sao-menu/releases/latest';
export const RELEASE_API = 'https://api.github.com/repos/willwang0202/sao-menu/releases/latest';
export interface UpdateTransport extends Pick<EventEmitter, 'on' | 'removeListener'> {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(): void;
}
interface Options {
  currentVersion: string; capability: UpdateCapability; automatic: boolean;
  updater?: UpdateTransport; latestRelease?: () => Promise<string>;
  prepareInstall?: () => Promise<void>;
  beforeInstall?: () => Promise<void>; onState?: (state: UpdateStatus) => void;
}
export function updateCapability(input: { packaged: boolean; platform: string; signedMac?: boolean; installedWindows?: boolean; appImage?: boolean }): UpdateCapability {
  if (!input.packaged) return 'unavailable';
  if (input.platform === 'darwin' && input.signedMac || input.platform === 'win32' && input.installedWindows || input.platform === 'linux' && input.appImage) return 'automatic';
  return 'manual';
}
function stableVersion(version: string): number[] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error('The release does not have a stable version.');
  return match.slice(1).map(Number);
}
export async function latestPublicRelease(): Promise<string> {
  const response = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Release check returned ${response.status}.`);
  const release = await response.json() as { draft?: boolean; prerelease?: boolean; tag_name?: string };
  if (release.draft || release.prerelease || typeof release.tag_name !== 'string') throw new Error('No stable release is available.');
  return release.tag_name.replace(/^v/, '');
}

/** Owns concurrency and user intent independently of the native installer transport. */
export class UpdateController {
  private state: UpdateStatus;
  private automatic: boolean;
  private checkOperation: Promise<UpdateStatus> | null = null;
  private downloadOperation: Promise<UpdateStatus> | null = null;
  private installOperation: Promise<UpdateStatus> | null = null;
  private initialTimer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private disposed = false;
  private listeners: Array<[string, (...args: any[]) => void]> = [];
  constructor(private readonly options: Options) {
    this.automatic = options.automatic;
    this.state = { capability: options.capability, status: options.capability === 'unavailable' ? 'disabled' : 'idle', currentVersion: options.currentVersion,
      message: options.capability === 'unavailable' ? 'Updates are available in an installed release.' : 'Ready to check for updates.' };
    const updater = options.updater;
    if (options.capability === 'automatic' && !updater) throw new Error('An automatic updater transport is required.');
    if (!updater) return;
    // The controller owns download intent. Nothing installs just because the app exits.
    updater.autoDownload = false; updater.autoInstallOnAppQuit = false;
    this.listen('checking-for-update', () => this.publish({ status: 'checking', message: 'Checking for updates…' }));
    this.listen('update-available', (info: { version: string }) => this.publish({ status: 'available', latestVersion: info.version, checkedAt: Date.now(), percent: undefined, message: `Version ${info.version} is available.` }));
    this.listen('update-not-available', (info: { version: string }) => this.publish({ status: 'current', latestVersion: info.version, checkedAt: Date.now(), percent: undefined, message: 'You have the latest version.' }));
    this.listen('download-progress', (progress: { percent: number }) => {
      if (this.state.status !== 'downloading') return;
      const percent = Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, progress.percent)) : 0;
      this.publish({ percent, message: `Downloading update… ${Math.floor(percent)}%` });
    });
    this.listen('update-downloaded', (info: { version: string }) => this.publish({ status: 'downloaded', latestVersion: info.version, percent: 100, message: `Version ${info.version} is ready. Install and restart when you are ready.` }));
    this.listen('error', () => this.fail());
  }
  getState(): UpdateStatus { return { ...this.state }; }
  private listen(event: string, listener: (...args: any[]) => void): void {
    this.listeners.push([event, listener]); this.options.updater!.on(event, listener);
  }
  private publish(change: Partial<UpdateStatus>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...change }; this.options.onState?.(this.getState());
  }
  private fail(): void { this.publish({ status: 'error', percent: undefined, message: 'The update could not complete. Check your connection and try again.' }); }
  start(): void { this.started = true; this.schedule(); }
  setAutomatic(enabled: boolean): void {
    if (this.automatic === enabled) return;
    this.automatic = enabled;
    if (this.started) this.schedule();
    if (enabled && this.state.status === 'available' && this.options.capability === 'automatic') void this.download();
  }
  private schedule(): void {
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.interval) clearInterval(this.interval);
    this.initialTimer = null; this.interval = null;
    if (!this.automatic || this.disposed || this.state.capability === 'unavailable') return;
    this.initialTimer = setTimeout(() => { this.initialTimer = null; void this.check(); }, 45_000); this.initialTimer.unref();
    this.interval = setInterval(() => void this.check(), 4 * 60 * 60 * 1000); this.interval.unref();
  }
  check(): Promise<UpdateStatus> {
    if (this.checkOperation) return this.checkOperation;
    if (this.disposed || ['disabled', 'downloading', 'downloaded', 'installing'].includes(this.state.status)) return Promise.resolve(this.getState());
    this.checkOperation = Promise.resolve().then(async () => {
      this.publish({ status: 'checking', percent: undefined, latestVersion: undefined, message: 'Checking for updates…' });
      try {
        if (this.state.capability === 'automatic') {
          const result = await this.options.updater!.checkForUpdates();
          if (!result) throw new Error('The updater is inactive.');
        } else {
          const version = await (this.options.latestRelease ?? latestPublicRelease)();
          const next = stableVersion(version), current = stableVersion(this.state.currentVersion);
          const different = next.findIndex((part, index) => part !== current[index]);
          const available = different >= 0 && next[different] > current[different];
          this.publish({ status: available ? 'available' : 'current', latestVersion: version, checkedAt: Date.now(), message: available ? `Version ${version} is available. Download the installer to update.` : 'You have the latest version.' });
        }
        if (this.automatic && this.state.capability === 'automatic' && this.state.status === 'available') await this.download();
      } catch { this.fail(); }
      return this.getState();
    }).finally(() => { this.checkOperation = null; });
    return this.checkOperation;
  }
  download(): Promise<UpdateStatus> {
    if (this.downloadOperation) return this.downloadOperation;
    if (this.state.capability !== 'automatic') return Promise.reject(new Error('Download the installer from the release page.'));
    if (['downloading', 'downloaded', 'installing'].includes(this.state.status)) return Promise.resolve(this.getState());
    if (this.disposed || this.state.status !== 'available') return Promise.reject(new Error('Check for an available update first.'));
    this.publish({ status: 'downloading', percent: 0, message: 'Downloading update… 0%' });
    this.downloadOperation = Promise.resolve().then(async () => {
      try { await this.options.updater!.downloadUpdate(); } catch { this.fail(); }
      return this.getState();
    }).finally(() => { this.downloadOperation = null; });
    return this.downloadOperation;
  }
  install(): Promise<UpdateStatus> {
    if (this.installOperation) return this.installOperation;
    if (this.disposed || this.state.status !== 'downloaded') return Promise.reject(new Error('Download and verify an update before installing it.'));
    this.installOperation = Promise.resolve().then(async () => {
      this.publish({ status: 'installing', message: 'Preparing update for installation…' });
      try {
        await this.options.prepareInstall?.();
        await this.options.beforeInstall?.();
        this.publish({ status: 'installing', message: 'Installing update and restarting…' });
        this.options.updater!.quitAndInstall();
      } catch (error) {
        this.publish({ status: 'downloaded', message: 'Installation could not complete. Your download is retained; try Install and restart again.' });
        throw error;
      }
      return this.getState();
    }).finally(() => { this.installOperation = null; });
    return this.installOperation;
  }
  dispose(): void {
    this.disposed = true;
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.interval) clearInterval(this.interval);
    for (const [event, listener] of this.listeners) this.options.updater?.removeListener(event, listener);
    this.listeners = [];
  }
}

/** Squirrel.Mac stages asynchronously. Wait before entering the application's quit barrier. */
export function prepareMacUpdate(native: Pick<EventEmitter, 'once' | 'removeListener'> & { checkForUpdates(): void }): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); native.removeListener('update-downloaded', ready); native.removeListener('error', failed); };
    const ready = () => { cleanup(); resolve(); };
    const failed = (error: Error) => { cleanup(); reject(error); };
    const timer = setTimeout(() => failed(new Error('macOS update preparation timed out. Please try again.')), 60_000); timer.unref();
    native.once('update-downloaded', ready); native.once('error', failed);
    try { native.checkForUpdates(); } catch (error) { failed(error instanceof Error ? error : new Error(String(error))); }
  });
}
