import type { ThemeId } from './themes';
export type Platform = 'darwin' | 'win32' | 'linux' | 'web';
export interface Position { x: number; y: number }
export interface GestureStatus { supported: boolean; permission: 'granted' | 'denied' | 'unknown'; running: boolean; message: string }
export interface HandTrackingStatus { supported: boolean; enabled: boolean; permission: 'granted' | 'denied' | 'unknown'; running: boolean; message: string }
export interface HandCursor extends Position { visible: boolean }
export interface MenuEntry { id: string; name: string; description?: string; icon?: string; image?: string; infoPanel?: boolean; kind: 'menu' | 'launcher' | 'settings' | 'quit' | 'unsupported'; children?: MenuEntry[]; launcher?: LauncherItem; reason?: string; nativeTarget?: string; directory?: string; social?: 'friends' | 'messages' }
export interface LauncherItem { id: string; name: string; kind: 'application' | 'url' | 'folder' | 'file'; target: string }
export interface Settings {
  version: 1;
  playerName: string;
  sound: boolean;
  reducedMotion: boolean;
  alwaysOnTop: boolean;
  launchAtLogin: boolean;
  automaticUpdates: boolean;
  /** Opt-in webcam hand gestures. */
  handTracking: boolean;
  /** Shows the tracker's camera view with landmarks, for tuning. */
  handDebugView: boolean;
  shortcut: string;
  /** Launcher look: original SAO, ALO or GGO theme. */
  theme: ThemeId;
  /** Original SAO clock widget on the desktop. */
  showClock: boolean;
  /** Original mail-style button that opens Message. */
  showMessageButton: boolean;
  favorites: LauncherItem[];
  menu?: MenuEntry[];
}
export interface SystemStats {
  platform: Platform; hostname: string; cpuPercent: number | null;
  memoryUsed: number | null; memoryTotal: number | null;
  uptime: number | null; batteryPercent: number | null;
}
export interface RuntimeInfo { platform: Platform; version: string; desktop: boolean; shortcutRegistered: boolean; startup: boolean }
export interface ImportResult { imported: number; warnings: string[]; settings: Settings }
export type UpdateCapability = 'automatic' | 'manual' | 'unavailable';
export interface UpdateStatus {
  capability: UpdateCapability;
  status: 'disabled' | 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
  currentVersion: string; latestVersion?: string; percent?: number; checkedAt?: number; message: string;
}
export interface DesktopAPI {
  getUpdateStatus(): Promise<UpdateStatus>;
  checkForUpdates(): Promise<UpdateStatus>;
  downloadUpdate(): Promise<UpdateStatus>;
  installUpdate(): Promise<UpdateStatus>;
  openUpdatePage(): Promise<void>;
  onUpdateStatus(callback: (state: UpdateStatus) => void): () => void;
  getRuntime(): Promise<RuntimeInfo>;
  getGestureStatus(): Promise<GestureStatus>;
  requestGesturePermission(): Promise<GestureStatus>;
  getMenuAnchor(): Promise<Position>;
  setPointerPassthrough(enabled: boolean): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<Settings>;
  getSystemStats(): Promise<SystemStats>;
  listApplications(): Promise<LauncherItem[]>;
  listDirectory(target: string): Promise<LauncherItem[]>;
  launch(item: LauncherItem): Promise<void>;
  pickLauncher(kind: 'application' | 'folder'): Promise<LauncherItem | null>;
  importConfiguration(): Promise<ImportResult | null>;
  exportConfiguration(): Promise<boolean>;
  hide(): Promise<void>;
  quit(): Promise<void>;
  completeStartup(): Promise<void>;
  onStartupComplete(callback: () => void): () => void;
  /** `category` selects a root category (e.g. `message`) when the menu opens. */
  onToggleMenu(callback: (open?: boolean, anchor?: Position, category?: string) => void): () => void;
  onDismissMenu(callback: () => void): () => void;
  onGlobalPointerDown(callback: (point: Position) => void): () => void;
  onPointerMove(callback: (point: Position) => void): () => void;
  getHandTrackingStatus(): Promise<HandTrackingStatus>;
  onHandCursor(callback: (cursor: HandCursor) => void): () => void;
  onHandClick(callback: (point: Position) => void): () => void;
  openBrowser(): Promise<void>;
  openMedia(): Promise<void>;
  openGallery(): Promise<void>;
  dropFiles(files: File[]): Promise<void>;
}
declare global { interface Window { sao?: DesktopAPI } }
