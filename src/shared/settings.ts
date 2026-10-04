import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { ImportResult, LauncherItem, MenuEntry, Platform, Settings } from './contracts';
import { normalizeMenu, originalIcon } from './menu';
import { isThemeId } from './themes';
import { isStartupLanguageSetting } from './startup-language';
import { normalizeMapHome } from './map';

export const MAX_CONFIGURATION_BYTES = 2 * 1024 * 1024;
const MAX_FAVORITES = 200;
const text = (value: unknown, fallback: string, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : fallback;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;

export function defaultSettings(_platform: Platform, playerName = 'Kirito'): Settings {
  return {
    version: 1, playerName: playerName.slice(0, 40), sound: true,
    reducedMotion: false, alwaysOnTop: false, launchAtLogin: false, automaticUpdates: true, handTracking: false, handDebugView: false,
    shortcut: 'Alt+S', theme: 'sao', startupLanguage: 'system', showClock: true, showMessageButton: true,
    favorites: [],
  };
}

export function validateLauncher(value: unknown): LauncherItem {
  const item = record(value);
  if (!['application', 'url', 'folder', 'file'].includes(String(item.kind))) throw new Error('Choose an application, folder, file, or web link.');
  const name = text(item.name, '', 100);
  const target = text(item.target, '', 4096);
  const id = text(item.id, '', 200);
  if (!name || !target || !id || /[\u0000-\u001f\u007f]/.test(target)) throw new Error('The launcher entry has an invalid name, ID, or target.');
  if (item.kind === 'url') {
    let url: URL;
    try { url = new URL(target); } catch { throw new Error('Enter a complete http:// or https:// web address.'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Only HTTP and HTTPS links without embedded credentials are supported.');
  } else {
    const absolute = target.startsWith('/') || /^[A-Za-z]:[\\/]/.test(target) || /^\\\\[^\\]+\\[^\\]+/.test(target);
    if (!absolute) throw new Error('Applications and folders require an absolute path.');
    if (target.includes('%') && /%[A-Za-z][A-Za-z0-9_]*%/.test(target)) throw new Error('Windows environment variables must be replaced with a local path.');
  }
  return { id, name, target, kind: item.kind as LauncherItem['kind'] };
}

export function normalizeSettings(value: unknown, platform: Platform): Settings {
  const input = record(value);
  const defaults = defaultSettings(platform);
  const favorites: LauncherItem[] = [];
  const ids = new Set<string>();
  for (const raw of Array.isArray(input.favorites) ? input.favorites.slice(0, MAX_FAVORITES) : []) {
    try { const item = validateLauncher(raw); if (!ids.has(item.id)) { ids.add(item.id); favorites.push(item); } } catch { /* Discard invalid entries when recovering stored preferences. */ }
  }
  return {
    version: 1, playerName: text(input.playerName, defaults.playerName, 40) || defaults.playerName,
    sound: bool(input.sound, defaults.sound), reducedMotion: bool(input.reducedMotion, defaults.reducedMotion),
    alwaysOnTop: bool(input.alwaysOnTop, defaults.alwaysOnTop), launchAtLogin: bool(input.launchAtLogin, defaults.launchAtLogin),
    automaticUpdates: bool(input.automaticUpdates, defaults.automaticUpdates),
    handTracking: bool(input.handTracking, defaults.handTracking),
    handDebugView: bool(input.handDebugView, defaults.handDebugView),
    shortcut: text(input.shortcut, defaults.shortcut, 100) || defaults.shortcut,
    theme: isThemeId(input.theme) ? input.theme : defaults.theme,
    startupLanguage: isStartupLanguageSetting(input.startupLanguage) ? input.startupLanguage : defaults.startupLanguage,
    mapHome: normalizeMapHome(input.mapHome),
    showClock: bool(input.showClock, defaults.showClock), showMessageButton: bool(input.showMessageButton, defaults.showMessageButton),
    favorites,
    menu: normalizeMenu(input.menu, platform, validateLauncher),
  };
}

function localPathMatches(target: string, platform: Platform): boolean {
  if (platform === 'web') return false;
  return platform === 'win32' ? /^[A-Za-z]:[\\/]|^\\\\/.test(target) : target.startsWith('/');
}

function portableFavorites(values: unknown[], platform: Platform, warnings: string[]): LauncherItem[] {
  const favorites: LauncherItem[] = [];
  const ids = new Set<string>();
  for (const raw of values.slice(0, MAX_FAVORITES)) {
    try {
      const item = validateLauncher(raw);
      if (item.kind !== 'url' && !localPathMatches(item.target, platform)) {
        warnings.push(`${item.name}: choose a local ${item.kind}; its path belongs to another operating system.`); continue;
      }
      if (!ids.has(item.id)) { favorites.push(item); ids.add(item.id); }
    } catch (error) { warnings.push(error instanceof Error ? error.message : 'Skipped an invalid launcher entry.'); }
  }
  if (values.length > MAX_FAVORITES) warnings.push(`Only the first ${MAX_FAVORITES} launcher entries were imported.`);
  return favorites;
}

function importOriginalXML(source: string, current: Settings, platform: Platform): ImportResult {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('XML entity and document type declarations are not supported.');
  const validation = XMLValidator.validate(source);
  if (validation !== true) throw new Error('The launcher XML is malformed.');
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, processEntities: true, trimValues: true });
  const parsed = record(parser.parse(source));
  const root = record(parsed.root);
  if (!root.menu && !parsed.menu) throw new Error('Choose SAO Utils 2 Configs/system/launcher/menu.xml.');
  const warnings: string[] = [];
  const candidates: LauncherItem[] = [];
  let count = 0;
  function walk(menu: unknown, depth: number): MenuEntry[] {
    if (depth > 32) throw new Error('The launcher menu is nested too deeply.');
    const data = record(menu);
    const items = Array.isArray(data.item) ? data.item : data.item ? [data.item] : [];
    return items.map(raw => {
      if (++count > 2000) throw new Error('The launcher menu contains too many entries.');
      const item = record(raw);
      const name = text(item.label, text(item.text, 'Imported link', 100), 100);
      const id = text(item['@_id'], `import-${count}`, 200);
      const entry: MenuEntry = { id, name, kind: 'unsupported', icon: originalIcon(id), description: typeof item.text === 'string' ? item.text.slice(0, 2000) : undefined,
        infoPanel: ['user', 'settings'].includes(id), image: id === 'user' ? 'etc/info.png' : undefined };
      if (item.menu) return { ...entry, kind: 'menu', children: walk(item.menu, depth + 1) };
      if (item.action) {
        try {
          const action = record(JSON.parse(String(item.action)));
          const payload = record(action.data);
          if (action.source === 'nvg://system/action#open' && typeof payload.url === 'string' && /^https?:\/\//i.test(payload.url)) {
            const launcher: LauncherItem = { id, name, target: payload.url, kind: 'url' };
            validateLauncher(launcher); candidates.push(launcher);
            return { ...entry, kind: 'launcher', launcher };
          }
          if (action.source === 'nvg://system/action#misc' && payload.command === 'preferences') return { ...entry, kind: 'settings' };
          if (action.source === 'nvg://system/action#misc' && payload.command === 'exit') return { ...entry, kind: 'quit' };
          if (action.source === 'nvg://system/action#cmd' && typeof payload.command === 'string') {
            const command = payload.command.trim().toLowerCase();
            const known: Record<string, string> = { 'explorer.exe': 'explorer', 'notepad.exe': 'notepad', 'calc.exe': 'calculator', 'cmd.exe': 'cmd', 'eventvwr.msc': 'events', 'services.msc': 'services', 'compmgmt.msc': 'management' };
            if (known[command]) entry.nativeTarget = `app:${known[command]}`;
            const library = command.match(/^::\{031e4825-7b94-4dc3-b131-e946b44c8dd5\}\\(documents|music|pictures|videos)\.library-ms$/);
            if (library) entry.nativeTarget = `home:${({ documents: 'Documents', music: 'Music', pictures: 'Pictures', videos: platform === 'darwin' ? 'Movies' : 'Videos' } as Record<string, string>)[library[1]]}`;
          }
          entry.reason = entry.nativeTarget ? 'Uses the equivalent native desktop application or folder.' : 'Choose a local replacement for this Windows action.';
          warnings.push(`${name}: native Windows action ${entry.nativeTarget ? 'uses a local equivalent' : 'requires a local replacement'}.`);
        } catch { entry.reason = 'This action could not be read.'; warnings.push(`${name}: skipped an unreadable action.`); }
      } else if (item.folder || item.path || item.type === '101') {
        const folder = record(item.folder);
        const folderPath = String(folder.path ?? item.path ?? '').replace(/\\/g, '/');
        if (folderPath === 'file:///%ProgramData%/Microsoft/Windows/Start Menu/Programs') return { ...entry, kind: 'menu', nativeTarget: 'applications', children: [] };
        if (folderPath === 'file:///%UserProfile%/Desktop') return { ...entry, kind: 'menu', nativeTarget: 'home:Desktop', children: [] };
        entry.reason = 'Choose a local folder after importing.'; warnings.push(`${name}: choose a local folder after importing.`);
      } else { entry.reason = 'The original configuration has no action assigned.'; }
      return entry;
    });
  }
  const menu = walk(root.menu ?? parsed.menu, 0);
  const imported = portableFavorites(candidates, platform, warnings);
  const merged = [...current.favorites];
  for (const item of imported) {
    if (merged.some(existing => existing.target === item.target && existing.kind === item.kind)) continue;
    if (merged.length >= MAX_FAVORITES) { warnings.push('Favorites are full; remaining entries were skipped.'); break; }
    merged.push({ ...item, id: `xml-${merged.length}-${item.id}` });
  }
  return { imported: merged.length - current.favorites.length, warnings, settings: normalizeSettings({ ...current, favorites: merged, menu }, platform) };
}

export function parseConfiguration(source: string, current: Settings, platform: Platform): ImportResult {
  if (new TextEncoder().encode(source).byteLength > MAX_CONFIGURATION_BYTES) throw new Error('Configuration files must be smaller than 2 MB.');
  if (source.trimStart().startsWith('<')) return importOriginalXML(source, current, platform);
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error('Choose a valid SAO Utils 2 JSON file or an original launcher XML file.'); }
  const data = record(parsed);
  if (data.version !== 1 || !Array.isArray(data.favorites)) throw new Error('This is not a supported SAO Utils 2 version 1 configuration.');
  const warnings: string[] = [];
  const favorites = portableFavorites(data.favorites, platform, warnings);
  // Native login, shortcut and camera settings are device-specific and never activated by an imported file.
  const settings = normalizeSettings({
    ...data, favorites, launchAtLogin: current.launchAtLogin, shortcut: current.shortcut, alwaysOnTop: current.alwaysOnTop,
    automaticUpdates: current.automaticUpdates, handTracking: current.handTracking, handDebugView: current.handDebugView,
  }, platform);
  return { imported: favorites.length, warnings, settings };
}
