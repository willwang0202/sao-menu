import { app, autoUpdater as nativeUpdater, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, Notification, protocol, screen, session, shell, Tray, type IpcMainInvokeEvent } from 'electron';
import { readFile, realpath, rename, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import electronUpdater from 'electron-updater';
import { UpdateController, updateCapability, prepareMacUpdate, RELEASE_PAGE } from './updates';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ImportResult, LauncherItem, Position, Settings } from '../shared/contracts';
import { defaultSettings, MAX_CONFIGURATION_BYTES, normalizeSettings, parseConfiguration, validateLauncher } from '../shared/settings';
import { buildDefaultMenu, resolveNativeMenu } from '../shared/menu';
import { applicationRoots, assertLaunchTarget, launcherForTarget, launchLinuxApplication, listApplications, listDirectory, platform } from './applications';
import { getSystemStats } from './system';
import { createTrayIcon } from './tray-icon';
import { GestureController } from './gesture';
import { SurfaceManager } from './surfaces';
import { mediaKind } from '../shared/surfaces';
import { SurfaceLayoutStore } from './surface-store';
import { SocialClient } from './social';
import { HpDisplay } from './hud';
import { DesktopWidgets } from './widgets';
import { checkSystemUpdate } from './system-update';
import { MapLocation } from './location';
import { LAUNCHER_LEVEL } from '../shared/widgets';
import { pointerInterval } from '../shared/refresh';
import { HandTrackingController } from './hand-tracking';
import { accountServiceEndpoint } from '../shared/social';

protocol.registerSchemesAsPrivileged([{ scheme: 'sao-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);

const PRODUCT_NAME = 'SAO Menu';
/** Versions up to 0.1.8 were named SAO Utils 2; their settings, layouts and approvals stay in this folder. */
const DATA_FOLDER = 'SAO Utils 2';
app.setName(PRODUCT_NAME);
app.setPath('userData', path.join(app.getPath('appData'), DATA_FOLDER));

let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let quitFlushed = false;
let settings = defaultSettings(platform);
let shortcutRegistered = false;
let activeShortcut: string | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();
let menuAnchor: Position = { x: 400, y: 350 };
let applicationCatalogue: LauncherItem[] | null = null;
let surfaces: SurfaceManager;
let social: SocialClient;
let hpDisplay: HpDisplay;
let desktopWidgets: DesktopWidgets;
let updates: UpdateController;
let updateQuitting = false;
let installBarrier = false;
let startup = true;
let pointerTimer: ReturnType<typeof setInterval> | null = null;
let pointerDelay = 0;
function refreshPointerRate(): void {
  if (!window || window.isDestroyed()) return;
  const delay = pointerInterval(screen.getDisplayMatching(window.getBounds()).displayFrequency);
  if (pointerTimer && pointerDelay === delay) return;
  if (pointerTimer) clearInterval(pointerTimer);
  pointerDelay = delay;
  pointerTimer = setInterval(() => {
    if (!window?.isVisible()) return;
    const point = screen.getCursorScreenPoint(), bounds = window.getBounds();
    window.webContents.send('sao:pointer:move', { x: point.x - bounds.x, y: point.y - bounds.y });
  }, delay);
  pointerTimer.unref();
}
let catalogueOperation: Promise<LauncherItem[]> | null = null;
const mapLocation = new MapLocation(
  app.isPackaged ? path.join(process.resourcesPath, 'location-helper') : path.join(__dirname, 'location-helper'),
  () => settings.mapHome, app.getVersion(),
);
const gesture = new GestureController(
  app.isPackaged ? path.join(process.resourcesPath, 'gesture-helper') : path.join(__dirname, 'gesture-helper'),
  point => summonAt(point),
  () => window?.webContents.send('sao:menu:dismiss'),
  point => {
    if (!window?.isVisible()) return;
    const bounds = window.getBounds();
    window.webContents.send('sao:pointer:down', { x: point.x - bounds.x, y: point.y - bounds.y });
  },
);
const pickedTargets = new Set<string>();
// Applications returned by the original folder browser receive exact, bounded
// session capabilities. Browsing never grants their entire parent directory.
const browsedApplications = new Set<string>();
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
const grantsPath = () => path.join(app.getPath('userData'), 'approved-applications.json');

function developmentURL(): string | null {
  if (app.isPackaged || !process.env.SAO_DEV_URL) return null;
  const url = new URL(process.env.SAO_DEV_URL);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error('The development renderer must use a local HTTP address.');
  }
  return url.href;
}

const localRendererURL = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
const rendererURL = developmentURL() || localRendererURL;
const handTracking = new HandTrackingController(
  new URL('tracker.html', rendererURL).href,
  path.join(__dirname, 'tracker-preload.cjs'),
  {
    summon: point => {
      const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
      summonAt({ x: Math.round(area.x + point.x * area.width), y: Math.round(area.y + point.y * area.height) });
    },
    dismiss: () => window?.webContents.send('sao:menu:dismiss'),
    cursor: (point, visible) => sendHandPoint('sao:hand:cursor', point, { visible }),
    click: point => sendHandPoint('sao:hand:click', point, {}),
    debugClosed: () => { void saveSettings({ ...settings, handDebugView: false }).catch(error => console.warn('Could not save the debug view setting.', error)); },
  },
);

/** Converts a normalized hand position into overlay CSS pixels. */
function sendHandPoint(channel: 'sao:hand:cursor' | 'sao:hand:click', point: Position, extra: Record<string, unknown>): void {
  if (!window || window.isDestroyed() || !window.isVisible()) return;
  const bounds = window.getBounds();
  window.webContents.send(channel, { x: point.x * bounds.width, y: point.y * bounds.height, ...extra });
}

// An explicit native command-line profile also lets packaged acceptance checks
// run beside the user's app without sharing its settings, camera or instance lock.
const profileDirectory = app.commandLine.getSwitchValue('sao-profile') || (!app.isPackaged ? process.env.SAO_USER_DATA : undefined);
if (profileDirectory) {
  const isolatedData = path.resolve(profileDirectory);
  mkdirSync(isolatedData, { recursive: true });
  app.setPath('userData', isolatedData);
  const isolatedCache = path.join(isolatedData, 'cache'); mkdirSync(isolatedCache, { recursive: true });
  app.setPath('cache', isolatedCache);
}

function assertOwner(event: IpcMainInvokeEvent): void {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== rendererURL) {
    throw new Error('This request did not originate from the trusted desktop window.');
  }
}

function handler(channel: string, callback: (...arguments_: unknown[]) => unknown | Promise<unknown>): void {
  ipcMain.handle(channel, (event, ...arguments_: unknown[]) => {
    assertOwner(event);
    if (installBarrier && channel !== 'sao:update:status') throw new Error('The application is restarting for an update.');
    return callback(...arguments_);
  });
}

function serial<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation);
  writeQueue = next.catch(() => undefined);
  return next;
}

async function atomicWrite(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, file);
}

async function loadConfiguration(): Promise<void> {
  let loadedSettings = false;
  try {
    const info = await stat(settingsPath());
    if (info.size > MAX_CONFIGURATION_BYTES) throw new Error('Configuration exceeds the size limit.');
    settings = normalizeSettings(JSON.parse(await readFile(settingsPath(), 'utf8')), platform);
    loadedSettings = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('Unable to load desktop settings; using defaults.', error);
  }
  if (!loadedSettings) {
    const originalMenu = path.join(__dirname, rendererURL === localRendererURL ? '../dist/sao-original/menu.xml' : '../public/sao-original/menu.xml');
    try {
      const info = await stat(originalMenu);
      if (info.size <= MAX_CONFIGURATION_BYTES) settings = parseConfiguration(await readFile(originalMenu, 'utf8'), settings, platform).settings;
    } catch { /* A user-supplied original bundle is optional. */ }
  }
  if (platform === 'linux') settings.launchAtLogin = false;
  settings = await hydrateSettings(settings);
  try {
    const info = await stat(grantsPath());
    if (info.size > MAX_CONFIGURATION_BYTES) return;
    const grants: unknown = JSON.parse(await readFile(grantsPath(), 'utf8'));
    if (Array.isArray(grants)) for (const entry of grants.slice(0, 600)) if (typeof entry === 'string' && path.isAbsolute(entry) && !entry.includes('\0')) pickedTargets.add(entry);
  } catch { /* Permission grants are optional; no grant is safer than a malformed one. */ }
}

async function getApplicationCatalogue(): Promise<LauncherItem[]> {
  if (applicationCatalogue) return applicationCatalogue;
  if (!catalogueOperation) catalogueOperation = listApplications().then(items => {
    applicationCatalogue = items;
    catalogueOperation = null;
    return items;
  }, error => { catalogueOperation = null; throw error; });
  return catalogueOperation;
}

function applicationPermissions(): Set<string> {
  return new Set([...pickedTargets, ...browsedApplications]);
}

async function hydrateSettings(value: Settings): Promise<Settings> {
  const applications = await getApplicationCatalogue();
  return {
    ...value,
    menu: value.menu?.length
      ? resolveNativeMenu(value.menu, platform, applications, app.getPath('home'))
      : buildDefaultMenu(platform, applications, value.favorites, app.getPath('home')),
  };
}

function reveal(): void {
  summonAt(screen.getCursorScreenPoint());
}

function summonAt(point: Position, category?: string): void {
  if (!window) return;
  window.setIgnoreMouseEvents(false);
  if (window.isMinimized()) window.restore();
  const display = screen.getDisplayNearestPoint(point);
  const workArea = startup ? display.bounds : display.workArea;
  const width = workArea.width;
  const height = workArea.height;
  const x = workArea.x;
  const y = workArea.y;
  if (startup && platform === 'darwin' && !window.isSimpleFullScreen()) window.setSimpleFullScreen(true);
  window.setMinimumSize(Math.min(720, width), Math.min(540, height));
  window.setBounds({ x, y, width, height });
  window.setAlwaysOnTop(startup || settings.alwaysOnTop, startup ? 'screen-saver' : LAUNCHER_LEVEL);
  refreshPointerRate();
  const minimumX = Math.min(300, width / 2);
  const minimumY = Math.min(200, height / 2);
  menuAnchor = {
    x: Math.max(minimumX, Math.min(Math.max(minimumX, width - 400), point.x - x)),
    y: Math.max(minimumY, Math.min(Math.max(minimumY, height - 200), point.y - y)),
  };
  handTracking.setMenuOpen(true, { x: menuAnchor.x / width, y: menuAnchor.y / height });
  window.show();
  window.focus();
  if (!startup) raiseWidgets();
  window.webContents.send('sao:menu:toggle', true, menuAnchor, category);
}

/** HP and desktop widgets always stay in front of the opened launcher. */
function raiseWidgets(): void { hpDisplay?.raise(); desktopWidgets?.raise(); }

function toggleMenu(): void {
  if (!window?.isVisible() || window.isMinimized()) reveal();
  else window.webContents.send('sao:menu:toggle');
}

function registerShortcut(shortcut: string): boolean {
  try { return globalShortcut.register(shortcut, toggleMenu); } catch { return false; }
}

function configureLogin(enabled: boolean): void {
  if (platform === 'linux') {
    if (enabled) throw new Error('Start at login is managed by your Linux desktop. Add SAO Menu to its Startup Applications settings.');
    return;
  }
  if (!app.isPackaged && enabled) throw new Error('Start at login is available in the packaged desktop app.');
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath('exe'),
    ...(platform === 'win32' ? { args: ['--hidden'] } : {}),
  });
}

async function applySettings(input: unknown): Promise<Settings> {
    const next = await hydrateSettings(normalizeSettings(input, platform));
    const previous = settings;
    const previousShortcut = activeShortcut;
    let newShortcutRegistered = false;
    const handTrackingChanged = next.handTracking !== previous.handTracking;
    if (next.shortcut !== activeShortcut) {
      newShortcutRegistered = registerShortcut(next.shortcut);
      if (!newShortcutRegistered && next.shortcut !== previous.shortcut) throw new Error(`The shortcut ${next.shortcut} is already in use or is unavailable. Your previous shortcut was kept.`);
    }
    try {
      if (next.launchAtLogin !== previous.launchAtLogin) configureLogin(next.launchAtLogin);
      window?.setAlwaysOnTop(next.alwaysOnTop, LAUNCHER_LEVEL);
      if (handTrackingChanged) await (next.handTracking ? handTracking.enable(true) : handTracking.disable());
      if (next.handDebugView !== previous.handDebugView) handTracking.setDebugView(next.handDebugView);
      await atomicWrite(settingsPath(), next);
    } catch (error) {
      if (handTrackingChanged) await restoreHandTracking(previous.handTracking);
      handTracking.setDebugView(previous.handDebugView);
      if (newShortcutRegistered) globalShortcut.unregister(next.shortcut);
      window?.setAlwaysOnTop(previous.alwaysOnTop, LAUNCHER_LEVEL);
      try { if (next.launchAtLogin !== previous.launchAtLogin) configureLogin(previous.launchAtLogin); } catch { /* Preserve the original failure. */ }
      throw error;
    }
    if (newShortcutRegistered && previousShortcut) globalShortcut.unregister(previousShortcut);
    settings = next;
    desktopWidgets?.update(); hpDisplay?.update();
    updates?.setAutomatic(next.automaticUpdates);
    activeShortcut = newShortcutRegistered ? next.shortcut : previousShortcut;
    shortcutRegistered = activeShortcut !== null;
    updateTrayMenu();
    return structuredClone(settings);
}

async function restoreHandTracking(enabled: boolean): Promise<void> {
  if (!enabled) { handTracking.disable(); return; }
  try { await handTracking.enable(false); } catch (error) { console.warn('Hand tracking could not be restored.', error); }
}

function saveSettings(input: unknown): Promise<Settings> {
  return serial(() => applySettings(input));
}

function showSurfaceError(error: unknown): void {
  dialog.showErrorBox('Preview could not open', error instanceof Error ? error.message : String(error));
}

function updateTrayMenu(): void {
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open SAO Menu', click: reveal },
    { label: 'Web Browser', click: () => void surfaces.openBrowser().catch(showSurfaceError) },
    { label: 'Preview images and videos…', click: () => { if (window) void surfaces.pickMedia(window).catch(showSurfaceError); } },
    { label: 'Gallery Widget…', click: () => { if (window) void surfaces.pickGallery(window).catch(showSurfaceError); } },
    { label: `Menu shortcut: ${settings.shortcut}`, enabled: false },
    { type: 'separator' },
    { label: 'Check for updates…', click: () => void checkUpdatesFromMenu() },
    ...(updates?.getState().status === 'downloaded' ? [{ label: 'Install update and restart', click: () => void updates.install().catch(showUpdateError) }] : []),
    { label: 'Hide overlay', click: () => window?.hide() },
    { label: 'Quit SAO Menu', click: () => { quitting = true; app.quit(); } },
  ]));
}

function installNativeMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [];
  if (platform === 'darwin') template.push({ role: 'appMenu' });
  template.push(
    { label: 'File', submenu: [
      { label: 'Show overlay', click: reveal },
      { label: 'Web Browser', click: () => void surfaces.openBrowser().catch(showSurfaceError) },
      { label: 'Preview images and videos…', click: () => { if (window) void surfaces.pickMedia(window).catch(showSurfaceError); } },
      { label: 'Gallery Widget…', click: () => { if (window) void surfaces.pickGallery(window).catch(showSurfaceError); } },
      { label: 'Hide overlay', click: () => window?.hide() },
      { type: 'separator' },
      { role: 'quit' },
    ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Help', submenu: [{ label: 'Check for updates…', click: () => void checkUpdatesFromMenu() }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { label: 'Show SAO Menu', click: reveal }] },
  );
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function pickLauncher(kind: unknown): Promise<LauncherItem | null> {
  if (kind !== 'application' && kind !== 'folder') throw new Error('Unsupported launcher kind.');
  if (!window) throw new Error('The desktop window is unavailable.');
  const result = await dialog.showOpenDialog(window, {
    title: kind === 'folder' ? 'Choose a folder to open' : 'Choose an application to launch',
    buttonLabel: 'Add launcher',
    defaultPath: kind === 'application' ? applicationRoots()[0] : app.getPath('home'),
    properties: kind === 'folder' ? ['openDirectory'] : ['openFile'],
    filters: kind === 'application' && platform !== 'darwin' ? [{ name: 'Applications', extensions: platform === 'win32' ? ['exe', 'lnk'] : ['desktop'] }] : undefined,
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const target = await realpath(result.filePaths[0]);
  const item = validateLauncher(launcherForTarget(target, kind));
  const temporaryGrants = new Set(pickedTargets);
  temporaryGrants.add(target);
  await assertLaunchTarget(item, temporaryGrants);
  if (kind === 'application') await serial(async () => {
    if (pickedTargets.has(target)) return;
    if (pickedTargets.size >= 600) throw new Error('The application permission limit has been reached.');
    pickedTargets.add(target);
    try { await atomicWrite(grantsPath(), [...pickedTargets]); }
    catch (error) { pickedTargets.delete(target); throw error; }
  });
  return item;
}

async function importConfiguration(): Promise<ImportResult | null> {
  if (!window) throw new Error('The desktop window is unavailable.');
  const result = await dialog.showOpenDialog(window, {
    title: 'Import a configuration',
    buttonLabel: 'Import configuration', properties: ['openFile'],
    filters: [{ name: 'SAO configuration', extensions: ['json', 'xml'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const info = await stat(result.filePaths[0]);
  if (info.size > MAX_CONFIGURATION_BYTES) throw new Error(`Configuration files must be smaller than ${MAX_CONFIGURATION_BYTES / 1024 / 1024} MB.`);
  const source = await readFile(result.filePaths[0], 'utf8');
  // The merge and commit share the same queue as ordinary saves, so late disk
  // reads cannot overwrite a settings edit submitted while a chooser was open.
  return serial(async () => {
    const imported = parseConfiguration(source, settings, platform);
    if (platform === 'linux' && imported.settings.launchAtLogin) {
      imported.settings.launchAtLogin = false;
      imported.warnings.push('Start at login is managed by your Linux desktop and was left disabled.');
    }
    for (const favorite of imported.settings.favorites) {
      try { await assertLaunchTarget(favorite, applicationPermissions()); }
      catch (error) { imported.warnings.push(`${favorite.name}: ${(error as Error).message}`); }
    }
    imported.settings = await applySettings(imported.settings);
    return imported;
  });
}

function showUpdateError(error: unknown): void {
  dialog.showErrorBox('Update could not complete', error instanceof Error ? error.message : String(error));
}
async function checkUpdatesFromMenu(): Promise<void> {
  const state = await updates.check();
  const action = state.status === 'downloaded' ? 'Install and restart' : state.status === 'available' ? state.capability === 'automatic' ? 'Download update' : 'Open downloads' : null;
  const result = await dialog.showMessageBox({ type: state.status === 'error' ? 'error' : 'info', title: 'SAO Menu updates', message: state.message,
    detail: `Installed version: ${state.currentVersion}`, buttons: action ? [action, 'Later'] : ['OK'], defaultId: action ? 1 : 0, cancelId: action ? 1 : 0 });
  if (!action || result.response !== 0) return;
  try {
    if (state.status === 'downloaded') await updates.install();
    else if (state.capability === 'automatic') await updates.download();
    else await shell.openExternal(RELEASE_PAGE);
  } catch (error) { showUpdateError(error); }
}
function createUpdates(): void {
  let signedMac = false;
  if (app.isPackaged && platform === 'darwin') {
    const signature = spawnSync('/usr/bin/codesign', ['-dv', '--verbose=2', path.resolve(path.dirname(process.execPath), '../..')], { encoding: 'utf8', timeout: 5000 });
    signedMac = signature.status === 0 && signature.stderr.includes('Authority=Developer ID Application:');
  }
  const capability = updateCapability({ packaged: app.isPackaged, platform, signedMac,
    installedWindows: ['Uninstall SAO Menu.exe', 'Uninstall SAO Utils 2.exe'].some(name => existsSync(path.join(path.dirname(process.execPath), name))), appImage: !!process.env.APPIMAGE });
  const updater = capability === 'automatic' ? electronUpdater.autoUpdater : undefined;
  if (updater) {
    updater.setFeedURL({ provider: 'github', owner: 'willwang0202', repo: 'sao-menu', private: false });
    updater.allowPrerelease = false; updater.allowDowngrade = false;
    updater.disableDifferentialDownload = true;
    const install = updater.quitAndInstall.bind(updater);
    updater.quitAndInstall = () => {
      updateQuitting = true; quitting = true; quitFlushed = true;
      try { install(); } catch (error) { updateQuitting = false; quitting = false; quitFlushed = false; installBarrier = false; surfaces.setUpdateBarrier(false); throw error; }
    };
  }
  let macPrepared = false;
  if (updater && platform === 'darwin') {
    nativeUpdater.on('update-downloaded', () => { macPrepared = true; });
    nativeUpdater.on('error', () => { macPrepared = false; });
  }
  const releaseBarrier = () => { installBarrier = false; surfaces.setUpdateBarrier(false); };
  updates = new UpdateController({ currentVersion: app.getVersion(), capability, automatic: settings.automaticUpdates, updater,
    prepareInstall: updater && platform === 'darwin' ? async () => { if (!macPrepared) await prepareMacUpdate(nativeUpdater); } : undefined,
    beforeInstall: async () => {
      installBarrier = true; surfaces.setUpdateBarrier(true);
      try { await writeQueue; await surfaces.flush(); } catch (error) { releaseBarrier(); throw error; }
    },
    onState: state => {
      if ((state.status === 'error' || state.status === 'downloaded') && updateQuitting) { updateQuitting = false; quitting = false; quitFlushed = false; releaseBarrier(); }
      if (window && !window.isDestroyed()) window.webContents.send('sao:update:status', state);
      updateTrayMenu();
      if (state.status === 'downloaded' && Notification.isSupported()) new Notification({ title: 'SAO Menu update ready', body: state.message }).show();
    },
  });
}
function installHandlers(): void {
  handler('sao:update:status', () => updates.getState());
  handler('sao:update:check', () => updates.check());
  handler('sao:update:download', () => updates.download());
  handler('sao:update:install', () => updates.install());
  handler('sao:update:page', () => shell.openExternal(RELEASE_PAGE));
  handler('sao:social:state', () => social.getState());
  handler('sao:social:authenticate', input => social.authenticate(input));
  handler('sao:social:logout', () => social.logout());
  handler('sao:social:request', value => social.requestFriend(value));
  handler('sao:social:resolve', (id, action) => social.resolveRequest(id, action));
  handler('sao:social:remove', id => social.removeFriend(id));
  handler('sao:social:party:invite', peer => social.inviteParty(peer));
  handler('sao:social:party:resolve', (id, action) => social.resolveParty(id, action));
  handler('sao:social:party:leave', () => social.leaveParty());
  handler('sao:social:messages', peer => social.getMessages(peer));
  handler('sao:social:send', (peer, text) => social.sendMessage(peer, text));
  handler('sao:social:read', peer => social.markRead(peer));
  handler('sao:gallery:open', () => { if (!window) throw new Error('The launcher is unavailable.'); return surfaces.pickGallery(window); });
  handler('sao:media:drop', paths => surfaces.dropFiles(paths));
  handler('sao:browser:open', () => surfaces.openBrowser());
  handler('sao:media:open', () => window ? surfaces.pickMedia(window) : undefined);
  handler('sao:map:position', () => mapLocation.position());
  handler('sao:map:search', query => mapLocation.search(query));
  handler('sao:runtime', () => ({ platform, version: app.getVersion(), desktop: true, shortcutRegistered, startup }));
  handler('sao:startup:complete', () => {
    const wasStarting = startup; startup = false;
    if (wasStarting && window) {
      if (platform === 'darwin' && window.isSimpleFullScreen()) window.setSimpleFullScreen(false);
      const area = screen.getDisplayMatching(window.getBounds()).workArea;
      window.setBounds(area); window.setAlwaysOnTop(settings.alwaysOnTop, LAUNCHER_LEVEL); raiseWidgets(); refreshPointerRate();
    }
    if (social?.getState().snapshot) hpDisplay?.show();
    desktopWidgets?.show();
    window?.webContents.send('sao:startup:done');
  });
  handler('sao:gesture:status', () => gesture.getStatus());
  handler('sao:gesture:request', async () => {
    const status = await gesture.requestPermission();
    if (platform === 'darwin' && status.permission === 'denied') await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent');
    return status;
  });
  handler('sao:hand:status', () => handTracking.getStatus());
  handler('sao:menu:anchor', () => ({ ...menuAnchor }));
  handler('sao:pointer:passthrough', enabled => {
    if (typeof enabled !== 'boolean') throw new Error('Pointer passthrough must be a boolean.');
    if (platform === 'darwin' || platform === 'win32') window?.setIgnoreMouseEvents(enabled, { forward: true });
  });
  handler('sao:settings:get', async () => { await writeQueue; return structuredClone(settings); });
  handler('sao:settings:save', saveSettings);
  handler('sao:system', getSystemStats);
  handler('sao:applications', async () => {
    applicationCatalogue = await listApplications();
    return applicationCatalogue;
  });
  handler('sao:directory', async target => {
    const item = validateLauncher({ id: 'directory', name: 'Directory', kind: 'folder', target });
    const entries = await listDirectory(item.target);
    for (const entry of entries) {
      if (entry.kind !== 'application') continue;
      const canonical = await realpath(entry.target).catch(() => null);
      if (!canonical) continue;
      if (!browsedApplications.has(canonical) && browsedApplications.size >= 600) {
        const oldest = browsedApplications.values().next().value;
        if (oldest) browsedApplications.delete(oldest);
      }
      browsedApplications.add(canonical);
    }
    return entries;
  });
  handler('sao:launcher:pick', pickLauncher);
  handler('sao:launch', async input => {
    const item = validateLauncher(input);
    const target = await assertLaunchTarget(item, applicationPermissions());
    if (item.kind === 'url') await surfaces.openBrowser(target);
    else if (item.kind === 'file' && mediaKind(target)) await surfaces.openMedia(target);
    else if (platform === 'linux' && item.kind === 'application') await launchLinuxApplication(target);
    else {
      const error = await shell.openPath(target);
      if (error) throw new Error(error);
    }
  });
  handler('sao:configuration:import', importConfiguration);
  handler('sao:configuration:export', async () => {
    if (!window) throw new Error('The desktop window is unavailable.');
    const result = await dialog.showSaveDialog(window, {
      title: 'Export SAO Menu configuration', buttonLabel: 'Export configuration',
      defaultPath: path.join(app.getPath('documents'), 'sao-utils-2.json'),
      filters: [{ name: 'SAO Menu configuration', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return false;
    const exportPath = result.filePath;
    await serial(() => atomicWrite(exportPath, settings));
    return true;
  });
  handler('sao:hide', () => window?.hide());
  handler('sao:quit', () => { quitting = true; app.quit(); });
}

async function createWindow(): Promise<void> {
  const openedAtLogin = platform === 'darwin'
    ? app.getLoginItemSettings().wasOpenedAtLogin
    : platform === 'win32' && process.argv.includes('--hidden');
  const workArea = screen.getPrimaryDisplay().workArea;
  window = new BrowserWindow({
    width: workArea.width, height: workArea.height,
    minWidth: Math.min(720, workArea.width), minHeight: Math.min(540, workArea.height),
    x: workArea.x, y: workArea.y,
    show: false, frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    resizable: false, maximizable: false, fullscreenable: false,
    alwaysOnTop: settings.alwaysOnTop, title: PRODUCT_NAME,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
      webSecurity: true, allowRunningInsecureContent: false,
    },
  });
  window.on('close', event => { if (!quitting) { event.preventDefault(); window?.hide(); } });
  startup = !openedAtLogin;
  window.on('show', () => handTracking.setMenuOpen(true));
  window.on('hide', () => handTracking.setMenuOpen(false));
  if (platform === 'darwin') window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== rendererURL) event.preventDefault(); });
  window.webContents.on('will-redirect', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.once('ready-to-show', () => { if (!openedAtLogin) reveal(); });
  await window.loadURL(rendererURL);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', reveal);
  app.on('activate', reveal);
  app.on('before-quit', event => {
    quitting = true;
    if (quitFlushed || !surfaces) return;
    event.preventDefault();
    void surfaces.flush().catch(error => console.warn('Preview layout could not be saved.', error)).finally(() => { quitFlushed = true; app.quit(); });
  });
  app.on('will-quit', () => { updates?.dispose(); gesture.stop(); handTracking.stop(); surfaces?.stop(); social?.stop(); hpDisplay?.stop(); desktopWidgets?.stop(); if (pointerTimer) clearInterval(pointerTimer); globalShortcut.unregisterAll(); tray?.destroy(); });
  app.on('window-all-closed', () => { if (quitting) app.quit(); });
  app.whenReady().then(async () => {
    await loadConfiguration();
    surfaces = new SurfaceManager(rendererURL, path.join(__dirname, 'surface-preload.cjs'), () => settings.reducedMotion, new SurfaceLayoutStore(path.join(app.getPath('userData'), 'surface-layout.json')));
    social = new SocialClient(path.join(app.getPath('userData'), 'social-account.json'), state => { hpDisplay?.update(); desktopWidgets?.update(); if (!startup && state.snapshot) hpDisplay?.show(); else hpDisplay?.hide(); if (window && !window.isDestroyed()) window.webContents.send('sao:social:state', state); }, accountServiceEndpoint(app.isPackaged, process.env.SAO_TEST_SERVICE_URL));
    createUpdates();
    surfaces.install();
    // Everything is denied except the hand tracker's own video-only camera request.
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(handTracking.allowsPermission(contents, permission, details as { mediaTypes?: string[] })));
    session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) => handTracking.allowsPermission(contents, permission, details as { mediaType?: string }));
    installHandlers();
    installNativeMenu();
    shortcutRegistered = registerShortcut(settings.shortcut);
    activeShortcut = shortcutRegistered ? settings.shortcut : null;
    await createWindow();
    hpDisplay = new HpDisplay(rendererURL, () => settings, () => social.getState().snapshot);
    await hpDisplay.create();
    if (!startup && social.getState().snapshot) hpDisplay.show();
    desktopWidgets = new DesktopWidgets(rendererURL, () => settings, () => social.getState().snapshot, () => summonAt(screen.getCursorScreenPoint(), 'message'));
    await desktopWidgets.create();
    if (!startup) desktopWidgets.show();
    // After an OS update, the next launch plays the Congratulations!! banner once Link Start is over.
    void checkSystemUpdate(path.join(app.getPath('userData'), 'system-version.json'), platform, process.getSystemVersion()).then(label => { if (label) desktopWidgets.celebrate(label); });
    await surfaces.restore();
    await social.start();
    gesture.start();
    handTracking.setDebugView(settings.handDebugView);
    if (settings.handTracking) void handTracking.enable(false).catch(error => console.warn('Hand tracking could not start.', error));
    refreshPointerRate();
    screen.on('display-metrics-changed', refreshPointerRate);
    screen.on('display-added', refreshPointerRate); screen.on('display-removed', refreshPointerRate);
    tray = new Tray(createTrayIcon());
    tray.setToolTip(PRODUCT_NAME);
    tray.on('click', reveal);
    updateTrayMenu();
    updates.start();
    if (settings.launchAtLogin) {
      try { configureLogin(true); } catch (error) { console.warn('Start at login could not be applied.', error); }
    }
  }).catch(error => {
    dialog.showErrorBox('SAO Menu could not start', error instanceof Error ? error.message : String(error));
    quitting = true; app.quit();
  });
}
