import type { LauncherItem, MenuEntry, Platform } from './contracts';

const rootIcons: Record<string, string> = { user: 'symbol/info.png', party: 'symbol/party.png', message: 'symbol/msg.png', navigation: 'symbol/navi.png', settings: 'symbol/setting.png' };
const itemIcons: Record<string, string> = {
  'user.items': 'item/items.png', 'user.skills': 'item/skills.png', 'user.equipment': 'item/equipment.png',
  'user.documents': 'item/Other/favs2.png', 'user.music': 'item/Media/iTunes.png', 'user.pictures': 'item/Media/landskape.png', 'user.videos': 'item/Media/YT2.png',
  'user.explorer': 'item/System/windows.png', 'user.notepad': 'item/Other/book.png', 'user.calculator': 'item/Other/calculator.png', 'user.cmd': 'item/System/sett-big.png',
  'navigation.search': 'item/Network/search.png', 'navigation.favorite': 'item/Other/Favs1.png', 'navigation.bilibili': 'item/Media/WMP.png',
  'settings.option': 'item/option.png', 'settings.help': 'item/help.png', 'settings.exit': 'item/logout.png',
};
export function originalIcon(id: string): string { return rootIcons[id] ?? itemIcons[id] ?? 'symbol/help.png'; }

const macApplications: Record<string, string> = {
  explorer: '/System/Library/CoreServices/Finder.app', notepad: '/System/Applications/TextEdit.app', calculator: '/System/Applications/Calculator.app',
  cmd: '/System/Applications/Utilities/Terminal.app', events: '/System/Applications/Utilities/Console.app',
  services: '/System/Applications/Utilities/Activity Monitor.app', management: '/System/Applications/Utilities/Disk Utility.app',
};
const equivalentNames: Record<string, string[]> = { explorer: ['Files', 'Dolphin', 'Thunar', 'Nautilus'], notepad: ['Text Editor', 'Gedit', 'Kate', 'Mousepad'], calculator: ['Calculator', 'KCalc', 'Qalculate!'], cmd: ['Terminal', 'Konsole', 'Xfce Terminal'], events: ['Logs'], services: ['System Monitor', 'Task Manager'], management: ['Disks', 'Partition Manager'] };
const windowsNames: Record<string, string[]> = { explorer: ['Explorer', 'File Explorer'], notepad: ['Notepad'], calculator: ['calc', 'Calculator'], cmd: ['cmd', 'Command Prompt'], events: ['Event Viewer'], services: ['Services'], management: ['Computer Management'] };

export function resolveNativeMenu(menu: MenuEntry[], platform: Platform, applications: LauncherItem[], home?: string): MenuEntry[] {
  return menu.map(original => {
    const item = { ...original, children: original.children ? resolveNativeMenu(original.children, platform, applications, home) : undefined };
    if (item.id === 'party' || item.id === 'message') return { ...item, kind: 'menu' as const, social: item.id === 'party' ? 'friends' as const : 'messages' as const, children: [], nativeTarget: undefined, directory: undefined };
    if (item.nativeTarget?.startsWith('app:')) {
      const key = item.nativeTarget.slice(4);
      const app = platform === 'darwin' && macApplications[key] ? { id: `mapped-${item.id}`, name: item.name, target: macApplications[key], kind: 'application' as const } : applications.find(app => ((platform === 'win32' ? windowsNames : equivalentNames)[key] ?? []).some(name => app.name.toLowerCase() === name.toLowerCase()));
      return app ? { ...item, kind: 'launcher' as const, launcher: { ...app, name: item.name }, reason: undefined } : { ...item, kind: 'unsupported' as const, reason: `Choose a local application for ${item.name}.` };
    }
    if (item.nativeTarget?.startsWith('home:') && home) {
      const folder = item.nativeTarget.slice(5);
      const target = home.replace(/[\\/]$/, '') + (platform === 'win32' ? '\\' : '/') + folder;
      return item.kind === 'menu' ? { ...item, directory: target } : { ...item, kind: 'launcher' as const, launcher: { id: `mapped-${item.id}`, name: item.name, target, kind: 'folder' as const }, reason: undefined };
    }
    if (item.nativeTarget === 'applications') return { ...item, kind: 'menu' as const, children: applications.map(app => ({ id: app.id, name: app.name, kind: 'launcher' as const, launcher: app, icon: 'item/file.png' })) };
    return item;
  });
}

export function buildDefaultMenu(platform: Platform, applications: LauncherItem[], favorites: LauncherItem[], home?: string): MenuEntry[] {
  const node = (id: string, name: string, children: MenuEntry[], description?: string): MenuEntry => ({ id, name, kind: 'menu', children, description, icon: originalIcon(id) });
  const native = (id: string, name: string, nativeTarget: string): MenuEntry => ({ id, name, kind: 'unsupported', nativeTarget, icon: originalIcon(id) });
  const roots = [
    { ...node('user', 'Kirito', [
      node('user.items', 'Items', ['Documents', 'Music', 'Pictures', 'Movies'].map((folder, index) => native(['user.documents', 'user.music', 'user.pictures', 'user.videos'][index], ['My Documents', 'My Music', 'My Pictures', 'My Videos'][index], `home:${folder}`))),
      node('user.skills', 'Skills', [['explorer', 'Explorer'], ['notepad', 'Notepad'], ['calculator', 'Calculator'], ['cmd', 'CMD']].map(([key, name]) => native(`user.${key}`, name, `app:${key}`))),
      node('user.equipment', 'Equipment', [['events', 'Events'], ['services', 'Services'], ['management', 'Management']].map(([key, name]) => native(`user.${key}`, name, `app:${key}`))),
    ], 'Welcome to Sword Art Online!'), image: 'etc/info.png', infoPanel: true },
    { ...node('party', 'Party', []), nativeTarget: 'applications' },
    node('message', 'Message', favorites.map(item => ({ id: item.id, name: item.name, kind: 'launcher', launcher: item, icon: 'item/file.png' }))),
    node('navigation', 'Navigation', [node('navigation.favorite', 'Favorite', favorites.filter(item => item.kind === 'url').map(item => ({ id: item.id, name: item.name, kind: 'launcher', launcher: item, icon: originalIcon(item.id) })))]),
    { ...node('settings', 'Settings', [
      { id: 'settings.option', name: 'Option', kind: 'settings', icon: originalIcon('settings.option') },
      { id: 'settings.help', name: 'Help', kind: 'settings', icon: originalIcon('settings.help') },
      { id: 'settings.exit', name: 'Exit', kind: 'quit', icon: originalIcon('settings.exit') },
    ]), infoPanel: true },
  ];
  return resolveNativeMenu(roots, platform, applications, home);
}

export function normalizeMenu(value: unknown, platform: Platform, validate: (input: unknown) => LauncherItem): MenuEntry[] {
  if (!Array.isArray(value)) return [];
  let count = 0;
  function walk(values: unknown[], depth: number): MenuEntry[] {
    if (depth > 32) return [];
    return values.slice(0, 2000).flatMap(raw => {
      if (++count > 2000 || !raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
      const data = raw as Record<string, unknown>;
      if (typeof data.id !== 'string' || typeof data.name !== 'string' || !['menu', 'launcher', 'settings', 'quit', 'unsupported'].includes(String(data.kind))) return [];
      const asset = (value: unknown) => typeof value === 'string' && /^(?:symbol|item|etc|icon)\/[A-Za-z0-9_ /.-]+\.png$/.test(value) && !value.includes('..') ? value : undefined;
      const item: MenuEntry = { id: data.id.slice(0, 200), name: data.name.slice(0, 100), kind: data.kind as MenuEntry['kind'], icon: asset(data.icon), image: asset(data.image), infoPanel: data.infoPanel === true,
        description: typeof data.description === 'string' ? data.description.slice(0, 2000) : undefined, reason: typeof data.reason === 'string' ? data.reason.slice(0, 500) : undefined,
        nativeTarget: typeof data.nativeTarget === 'string' && /^(?:app:(?:explorer|notepad|calculator|cmd|events|services|management)|home:(?:Documents|Music|Pictures|Movies|Videos|Desktop)|applications)$/.test(data.nativeTarget) ? data.nativeTarget : undefined,
        directory: typeof data.directory === 'string' && data.directory.length <= 4096 && !/[\u0000-\u001f]/.test(data.directory) && (platform === 'win32' ? /^[A-Za-z]:[\\/]/.test(data.directory) : data.directory.startsWith('/')) ? data.directory : undefined };
      if (item.kind === 'menu') item.children = walk(Array.isArray(data.children) ? data.children : [], depth + 1);
      if (item.kind === 'launcher') {
        try {
          item.launcher = validate(data.launcher);
          const target = item.launcher.target;
          if (item.launcher.kind !== 'url' && (platform === 'web' || (platform === 'win32' ? target.startsWith('/') : !target.startsWith('/')))) {
            item.kind = 'unsupported'; item.reason = 'Choose a local target for this entry.'; item.launcher = undefined;
          }
        } catch { item.kind = 'unsupported'; item.reason = 'Choose a valid local target for this entry.'; }
      }
      return [item];
    });
  }
  return walk(value, 0);
}
