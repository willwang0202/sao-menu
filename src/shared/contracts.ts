export type Platform = 'darwin' | 'win32' | 'linux' | 'web';
export interface Position { x: number; y: number }
export interface GestureStatus { supported: boolean; permission: 'granted' | 'denied' | 'unknown'; running: boolean; message: string }
export interface MenuEntry { id: string; name: string; description?: string; icon?: string; image?: string; infoPanel?: boolean; kind: 'menu' | 'launcher' | 'settings' | 'quit' | 'unsupported'; children?: MenuEntry[]; launcher?: LauncherItem; reason?: string; nativeTarget?: string; directory?: string; social?: 'friends' | 'messages' }
export interface LauncherItem { id: string; name: string; kind: 'application' | 'url' | 'folder' | 'file'; target: string }
export interface Settings {
  version: 1;
  playerName: string;
  sound: boolean;
  reducedMotion: boolean;
  alwaysOnTop: boolean;
  launchAtLogin: boolean;
  shortcut: string;
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
export interface DesktopAPI {
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
  onToggleMenu(callback: (open?: boolean, anchor?: Position) => void): () => void;
  onDismissMenu(callback: () => void): () => void;
  onGlobalPointerDown(callback: (point: Position) => void): () => void;
  onPointerMove(callback: (point: Position) => void): () => void;
  openBrowser(): Promise<void>;
  openMedia(): Promise<void>;
  openGallery(): Promise<void>;
  dropFiles(files: File[]): Promise<void>;
}
declare global { interface Window { sao?: DesktopAPI } }
