import type { DesktopAPI, LauncherItem, Settings, SystemStats } from './contracts';
import { defaultSettings, normalizeSettings, validateLauncher, parseConfiguration } from './settings';
import { resolveMapPosition, type HelperLocation } from './map';

const KEY = 'sao-desktop.settings.v1';
let startup = true;
function read(): Settings {
  const stored = localStorage.getItem(KEY);
  if (!stored) return defaultSettings('web');
  try { return normalizeSettings(JSON.parse(stored), 'web'); } catch { return defaultSettings('web'); }
}
const unavailable = async (): Promise<never> => { throw new Error('Open SAO Menu to use this native desktop feature.'); };
const previewStats: SystemStats = { platform: 'web', hostname: 'Browser preview', cpuPercent: null, memoryUsed: null, memoryTotal: null, uptime: null, batteryPercent: null };
const browserAPI: DesktopAPI = {
  getUpdateStatus: async () => ({ capability: 'unavailable', status: 'disabled', currentVersion: 'Browser preview', message: 'Updates are available in an installed release.' }),
  checkForUpdates: unavailable, downloadUpdate: unavailable, installUpdate: unavailable, openUpdatePage: unavailable,
  onUpdateStatus: () => () => {},
  getRuntime: async () => ({ platform: 'web', version: '0.1.2', desktop: false, shortcutRegistered: false, startup }),
  getGestureStatus: async () => ({ supported: false, permission: 'unknown', running: false, message: 'Global mouse gestures require the macOS desktop app.' }),
  requestGesturePermission: unavailable,
  getMenuAnchor: async () => ({ x: Math.max(330, window.innerWidth / 2), y: window.innerHeight / 2 }),
  setPointerPassthrough: async () => {},
  getSettings: async () => {
    const settings = read();
    if (settings.menu?.length) return settings;
    try {
      const response = await fetch('./sao-original/menu.xml');
      if (response.ok) return parseConfiguration(await response.text(), settings, 'web').settings;
    } catch { /* A checkout without imported resources uses the portable fallback. */ }
    return settings;
  },
  saveSettings: async (value: Settings) => { const next = normalizeSettings(value, 'web'); localStorage.setItem(KEY, JSON.stringify(next)); return next; },
  getSystemStats: async () => previewStats,
  // Browser preview: the browser's own geolocation, else the saved home.
  getMapPosition: async () => {
    const home = normalizeSettings(JSON.parse(localStorage.getItem(KEY) ?? '{}'), 'web').mapHome;
    const location = await new Promise<HelperLocation>(resolve => {
      if (!navigator.geolocation) { resolve({ ok: false, error: 'unsupported' }); return; }
      navigator.geolocation.getCurrentPosition(fix => resolve({ ok: true, latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy }),
        failure => resolve({ ok: false, error: failure.code === failure.PERMISSION_DENIED ? 'denied' : failure.code === failure.TIMEOUT ? 'timeout' : 'unavailable' }), { timeout: 15000, maximumAge: 300000 });
    });
    return resolveMapPosition(location, home);
  },
  searchMapPlace: unavailable,
  listApplications: async () => [],
  listDirectory: unavailable,
  launch: async (raw: LauncherItem) => {
    const item = validateLauncher(raw);
    if (item.kind !== 'url') return unavailable();
    const opened = window.open(item.target, '_blank');
    if (!opened) throw new Error('Your browser blocked this link. Allow popups for this preview and try again.');
    opened.opener = null;
  },
  pickLauncher: unavailable, importConfiguration: unavailable, exportConfiguration: unavailable,
  hide: unavailable, quit: unavailable, completeStartup: async () => { startup = false; }, onStartupComplete: () => () => {}, onToggleMenu: () => () => {},
  onDismissMenu: () => () => {}, onGlobalPointerDown: () => () => {},
  onPointerMove: () => () => {},
  getHandTrackingStatus: async () => ({ supported: false, enabled: false, permission: 'unknown', running: false, message: 'Hand gestures require the desktop app.' }),
  onHandCursor: () => () => {}, onHandClick: () => () => {},
  openBrowser: unavailable, openMedia: unavailable, openGallery: unavailable, dropFiles: unavailable,
};
export const api: DesktopAPI = window.sao ?? browserAPI;
