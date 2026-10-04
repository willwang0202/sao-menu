import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Check, Download, Folder, Info, Link, LoaderCircle, Plus, Search, Upload, X } from 'lucide-react';
import { api } from '../shared/bridge';
import { Updates } from './updates';
import { buildDefaultMenu, resolveNativeMenu } from '../shared/menu';
import type { GestureStatus, LauncherItem, MenuEntry, Position, RuntimeInfo, Settings } from '../shared/contracts';
import './styles.css';
import { SurfaceApp } from './surface';
import { SocialPanel } from './social';
import type { SocialProfile } from '../shared/social';
import { HpHudWindow } from './hud';
import { LinkStart } from './startup';
import { HandReticle, HandTrackingStatusLine, useHandPointer } from './hand-pointer';
import { menuArtwork } from './menu-art';
import { THEME_IDS, THEME_NAMES, themeSound, type SoundEvent, type ThemeId } from '../shared/themes';
import { columnTops, launcherLayout, submenuLayout, type SubmenuLayout } from '../shared/theme-geometry';
import { themeHoverSource, themeIconSources, usesSaoVectorArt } from '../shared/theme-icons';
import { LauncherThemeContext, useLauncherTheme } from './theme-context';
import { GgoInfoPanel, GgoMenuTray, GgoRailTray, ggoPanelIndicatorTop, ggoPanelTop } from './ggo';

const IMAGE = './sao-original/Images/';
const SOUND = './sao-original/Sounds/';
const message = (e: unknown) => e instanceof Error ? e.message : String(e);
const platformName = (p?: string) => p === 'darwin' ? 'macOS' : p === 'win32' ? 'Windows' : p === 'linux' ? 'Linux' : 'Browser preview';
const rootIcons = ['symbol/info.png', 'symbol/party.png', 'symbol/msg.png', 'symbol/navi.png', 'symbol/setting.png'];
const iconPath = (entry: MenuEntry, root = false, index = 0) => {
  const path = entry.icon ?? (root ? rootIcons[index % rootIcons.length] : entry.kind === 'menu' ? 'item/folder.png' : entry.launcher?.kind === 'url' ? 'item/web.png' : entry.launcher?.kind === 'folder' ? 'item/folder.png' : 'item/help.png');
  return path.replace(/^\.\/sao-original\/Images\//, '').replace(/^Images\//, '').replace(/^\.\.\/Images\//, '');
};
function fallbackMenu(platform: RuntimeInfo['platform'], apps: LauncherItem[], favorites: LauncherItem[]): MenuEntry[] {
  return buildDefaultMenu(platform, apps, favorites).map(root => root.id === 'settings' ? {
    ...root,
    children: root.children?.map(entry => entry.id === 'settings.help' ? { ...entry, kind: 'unsupported', reason: 'The original configuration has no action assigned.' } : entry),
  } : root);
}

type Toast = { text: string; error?: boolean };
type Tab = 'options' | 'launcher' | 'about';
function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [account, setAccount] = useState<SocialProfile | null>(null);
  useEffect(() => {
    const social = window.saoSocial; if (!social) return;
    let active = true;
    const update = (state: Awaited<ReturnType<typeof social.getState>>) => { if (active) setAccount(state.snapshot?.profile ?? null); };
    const detach = social.onState(update); void social.getState().then(update).catch(() => {});
    return () => { active = false; detach(); };
  }, []);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [starting, setStarting] = useState(true);
  const startupCompleted = useRef(false);
  const [gesture, setGesture] = useState<GestureStatus | null>(null);
  const [apps, setApps] = useState<LauncherItem[]>([]);
  const [rootIndex, setRootIndex] = useState(0);
  const [rootStart, setRootStart] = useState(0);
  const [rootOpened, setRootOpened] = useState(false);
  const [path, setPath] = useState<string[]>([]);
  const [selectedRowTops, setSelectedRowTops] = useState<number[]>([]);
  const openDelay = useRef(700);
  const reportRowTop = useCallback((depth: number, top: number) => setSelectedRowTops(current => current[depth] === top ? current : Object.assign([...current], { [depth]: top })), []);
  const [menuVisible, setMenuVisible] = useState(true);
  const [entrance, setEntrance] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [preferences, setPreferences] = useState<Tab | null>(null);
  const [anchor, setAnchor] = useState<Position>({ x: innerWidth / 2, y: innerHeight / 2 });
  const [viewport, setViewport] = useState({ width: innerWidth, height: innerHeight });
  const [cursor, setCursor] = useState<Position | null>(null);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bootError, setBootError] = useState('');
  const [applicationError, setApplicationError] = useState('');
  const [directories, setDirectories] = useState<Record<string, MenuEntry[]>>({});
  const [directoryErrors, setDirectoryErrors] = useState<Record<string, string>>({});
  const loadingDirectories = useRef(new Set<string>());
  const settingsRef = useRef<Settings | null>(null);
  const persistedRef = useRef<Settings | null>(null);
  const revision = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const audio = useRef(new Map<string, HTMLAudioElement>());
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootDrag = useRef<{ y: number; index: number; steps: number } | null>(null);
  const suppressRootClick = useRef(0);
  const lastPointer = useRef<Position | null>(null);
  const evaluatePointer = useRef(() => {});
  const handPointer = useHandPointer(lastPointer, evaluatePointer, setCursor);
  const acceptsMouse = handPointer.acceptsMouse;
  const menuVisibleRef = useRef(menuVisible);
  menuVisibleRef.current = menuVisible;
  const toggleEvent = useRef<(open?: boolean, point?: Position) => void>(() => {});
  const outsideEvent = useRef<(point?: Position) => void>(() => {});
  const notice = useCallback((text: string, error = false) => setToast({ text, error }), []);
  const sound = useCallback((event: SoundEvent = 'click') => {
    if (!settingsRef.current?.sound) return;
    const file = themeSound(settingsRef.current.theme, event);
    let track = audio.current.get(file);
    if (!track) { track = new Audio(SOUND + file); track.volume = .3; audio.current.set(file, track); }
    track.currentTime = 0;
    void track.play().catch(() => {});
  }, []);
  const save = useCallback((change: Partial<Settings> | ((s: Settings) => Settings)) => {
    const current = settingsRef.current; if (!current) return;
    const next = typeof change === 'function' ? change(current) : { ...current, ...change };
    const delta: Partial<Settings> = {};
    for (const key of Object.keys(next) as (keyof Settings)[]) if (JSON.stringify(next[key]) !== JSON.stringify(current[key])) Object.assign(delta, { [key]: next[key] });
    if (!Object.keys(delta).length) return;
    settingsRef.current = next; setSettings(next);
    const changeRevision = ++revision.current; setSaving(true);
    saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
      const persisted = await api.saveSettings({ ...(persistedRef.current ?? next), ...delta });
      persistedRef.current = persisted; setSaveError(false);
      void api.getRuntime().then(setRuntime).catch(() => {});
      if (revision.current === changeRevision) { settingsRef.current = persisted; setSettings(persisted); }
    }).catch(async e => {
      setSaveError(true); notice(`Could not save: ${message(e)}`, true);
      if (revision.current === changeRevision) {
        try { const persisted = await api.getSettings(); persistedRef.current = persisted; if (revision.current === changeRevision) { settingsRef.current = persisted; setSettings(persisted); } } catch { /* Preserve the last known settings. */ }
      }
    }).finally(() => { if (revision.current === changeRevision) setSaving(false); });
  }, [notice]);
  const dismiss = useCallback(() => {
    if (dismissTimer.current) return;
    sound('dismissLauncher'); setLeaving(true); setPreferences(null);
    dismissTimer.current = setTimeout(() => {
      setMenuVisible(false); setRootOpened(false); setLeaving(false); dismissTimer.current = null;
      if (runtime?.desktop) void api.hide().catch(e => notice(message(e), true));
    }, settingsRef.current?.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400);
  }, [runtime, sound, notice]);
  toggleEvent.current = (open, point) => {
    if (starting) return;
    const show = open ?? (!menuVisibleRef.current || !!dismissTimer.current);
    if (!show) { dismiss(); return; }
    if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null; }
    menuVisibleRef.current = true;
    setLeaving(false); setMenuVisible(true);
    if (point) { setAnchor(point); lastPointer.current = point; }
    setEntrance(value => value + 1); setRootIndex(0); setRootStart(0); setRootOpened(false); setPath([]); setPreferences(null);
  };

  outsideEvent.current = point => {
    if (starting || !menuVisibleRef.current || preferences) return;
    if (point && [...document.querySelectorAll<HTMLElement>('.root-path,.submenu-column,.info-panel,.social-panel,.sao-notification')].some(element => {
      const box = element.getBoundingClientRect();
      return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
    })) return;
    dismiss();
  };

  useEffect(() => {
    let active = true;
    Promise.all([api.getSettings(), api.getRuntime(), api.getMenuAnchor(), api.getGestureStatus()]).then(([configuration, information, point, gestureStatus]) => {
      if (!active) return;
      settingsRef.current = configuration; persistedRef.current = configuration; setSettings(configuration); setRuntime(information); setStarting(information.startup && !startupCompleted.current); setAnchor(point); lastPointer.current = point; setGesture(gestureStatus);
    }).catch(e => active && setBootError(message(e)));
    void api.listApplications().then(result => active && setApps(result)).catch(e => active && setApplicationError(message(e)));
    const resize = () => setViewport({ width: innerWidth, height: innerHeight });
    addEventListener('resize', resize);
    const detach = api.onToggleMenu((open, point) => toggleEvent.current(open, point));
    const detachStartup = api.onStartupComplete(() => { startupCompleted.current = true; setStarting(false); });
    const detachDismiss = api.onDismissMenu(() => outsideEvent.current());
    const detachPointer = api.onGlobalPointerDown(point => outsideEvent.current(point));
    let motionFrame = 0;
    const queueMotion = (point: Position) => {
      lastPointer.current = point;
      if (!motionFrame) motionFrame = requestAnimationFrame(() => {
        motionFrame = 0; const latest = lastPointer.current!;
        setCursor(previous => previous?.x === latest.x && previous.y === latest.y ? previous : latest);
        evaluatePointer.current();
      });
    };
    // Unchanged mouse samples are ignored while the webcam hand is steering.
    const detachMotion = api.onPointerMove(point => { if (acceptsMouse(point)) queueMotion(point); });
    const localMotion = (event: MouseEvent) => { if (!window.sao) queueMotion({ x: event.clientX, y: event.clientY }); };
    addEventListener('mousemove', localMotion);
    return () => { active = false; cancelAnimationFrame(motionFrame); removeEventListener('resize', resize); removeEventListener('mousemove', localMotion); detach(); detachStartup(); detachDismiss(); detachPointer(); detachMotion(); if (dismissTimer.current) clearTimeout(dismissTimer.current); };
  }, []);
  useEffect(() => {
    if (!runtime?.desktop || !preferences) return;
    let active = true;
    const refresh = () => { void api.getGestureStatus().then(status => { if (active) setGesture(status); }).catch(() => {}); };
    refresh();
    const timer = setInterval(refresh, 2000);
    addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); removeEventListener('focus', refresh); };
  }, [runtime?.desktop, preferences]);
  useEffect(() => {
    let start: Position | null = null;
    let fired = false;
    const down = (event: MouseEvent) => { if (event.buttons === 3) { start = { x: event.clientX, y: event.clientY }; fired = false; } };
    const move = (event: MouseEvent) => {
      if (event.buttons !== 3) { start = null; fired = false; return; }
      if (!start || fired) return;
      const dy = event.clientY - start.y;
      if (Math.abs(dy) < 64 || Math.abs(event.clientX - start.x) > Math.max(32, Math.abs(dy) * .75)) return;
      fired = true;
      // Native builds use the global observer, which also works out of focus.
      if (!runtime?.desktop) { if (dy > 0) toggleEvent.current(true, { x: event.clientX, y: event.clientY }); else outsideEvent.current(); }
    };
    const up = () => { start = null; fired = false; };
    addEventListener('mousedown', down); addEventListener('mousemove', move); addEventListener('mouseup', up);
    return () => { removeEventListener('mousedown', down); removeEventListener('mousemove', move); removeEventListener('mouseup', up); };
  }, [runtime?.desktop]);
  useEffect(() => {
    const nativePassthrough = runtime?.desktop && ['darwin', 'win32'].includes(runtime.platform);
    let held = false;
    let previous: boolean | null = null;
    const passthrough = (enabled: boolean) => {
      if (!nativePassthrough) return;
      if (previous === enabled) return;
      previous = enabled;
      void api.setPointerPassthrough(enabled).catch(() => {});
    };
    const evaluate = () => {
      const point = lastPointer.current;
      const element = point ? document.elementFromPoint(point.x, point.y) : null;
      const hovered = element?.closest<HTMLElement>('[data-hover-id]');
      setHoveredButton(hovered && !hovered.closest('.dismissing') ? hovered.dataset.hoverId ?? null : null);
      if (held || document.querySelector('.dialog-scrim,.link-start')) { passthrough(false); return; }
      if (!point) { passthrough(true); return; }
      const selector = '.root-path,.submenu-column,.info-panel,.social-panel,.sao-dialog,.sao-notification';
      const hit = element?.closest(selector);
      const interactive = !!hit && !hit.closest('.dismissing') || [...document.querySelectorAll<HTMLElement>(selector)].some(element => {
        if (element.closest('.dismissing')) return false;
        const box = element.getBoundingClientRect();
        return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
      });
      passthrough(!interactive);
    };
    const move = (event: MouseEvent) => {
      // Forwarded Chromium movement can lag a native ownership handoff.
      // Desktop hover and click-through share the global pointer stream;
      // browser previews use their DOM pointer instead.
      if (!window.sao) lastPointer.current = { x: event.clientX, y: event.clientY };
      evaluate();
    };
    const down = () => { held = true; passthrough(false); };
    const up = () => { held = false; evaluate(); };
    // Native click-through handoffs can emit mouseleave without moving the
    // pointer. Keep ownership while the global position still hits a control.
    const leave = () => evaluate();
    addEventListener('mousemove', move);
    addEventListener('pointerdown', down, true);
    addEventListener('pointerup', up, true);
    addEventListener('pointercancel', up, true);
    document.documentElement.addEventListener('mouseleave', leave);
    let frame = 0;
    const tick = () => { evaluate(); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    evaluatePointer.current = evaluate;
    evaluate();
    return () => {
      cancelAnimationFrame(frame);
      evaluatePointer.current = () => {};
      removeEventListener('mousemove', move);
      removeEventListener('pointerdown', down, true);
      removeEventListener('pointerup', up, true);
      removeEventListener('pointercancel', up, true);
      document.documentElement.removeEventListener('mouseleave', leave);
      if (nativePassthrough && previous !== false) void api.setPointerPassthrough(false).catch(() => {});
    };
  }, [runtime?.desktop, runtime?.platform]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 6500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (starting || !menuVisible || !settings) return;
    sound('popupLauncher');
    const timer = setTimeout(() => { setRootOpened(true); }, settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : openDelay.current);
    return () => clearTimeout(timer);
  }, [starting, menuVisible, !!settings, entrance, sound]);

  const populateDirectory = (entry: MenuEntry): MenuEntry => entry.directory ? { ...entry, children: directories[entry.directory] ?? entry.children } : entry;
  const roots = resolveNativeMenu(settings?.menu?.length ? settings.menu : fallbackMenu(runtime?.platform ?? 'web', apps, settings?.favorites ?? []), runtime?.platform ?? 'web', apps).map(populateDirectory);
  const activeRoot = roots[rootIndex % Math.max(1, roots.length)];
  const columns: { parent: MenuEntry; selected?: string }[] = [];
  if (activeRoot?.kind === 'menu' && !activeRoot.social) {
    let parent = activeRoot;
    for (let depth = 0; depth < 12; depth++) {
      columns.push({ parent, selected: path[depth] });
      const next = parent.children?.find(entry => entry.id === path[depth]);
      if (next?.kind !== 'menu') break;
      parent = populateDirectory(next);
    }
  }
  const panelEntry = [...columns.map(column => column.parent)].reverse().find(parent => parent.infoPanel === true) ?? activeRoot;
  const directoryPaths = columns.map(column => column.parent.directory).filter((directory): directory is string => !!directory);
  const readDirectory = useCallback(async (directory: string) => {
    if (loadingDirectories.current.has(directory)) return;
    loadingDirectories.current.add(directory);
    try {
      const result = await api.listDirectory(directory);
      setDirectories(previous => ({ ...previous, [directory]: result.map(item => item.kind === 'folder' ? { id: item.id, name: item.name, kind: 'menu', directory: item.target, icon: 'item/folder.png', children: [] } : { id: item.id, name: item.name, kind: 'launcher', launcher: item, icon: 'item/file.png' }) }));
      setDirectoryErrors(previous => { const next = { ...previous }; delete next[directory]; return next; });
    } catch (e) { setDirectoryErrors(previous => ({ ...previous, [directory]: message(e) })); notice(message(e), true); }
    finally { loadingDirectories.current.delete(directory); }
  }, [notice]);
  useEffect(() => {
    for (const directory of directoryPaths) if (!directories[directory] && !directoryErrors[directory]) void readDirectory(directory);
  }, [directoryPaths.join('\0'), directories, directoryErrors, readDirectory]);
  const theme = settings?.theme ?? 'sao';
  const isGgo = theme === 'ggo';
  // Reserve every category's expansion area up front, so selecting a lower
  // category moves its menus without shifting the category rail to fit them.
  const layout = launcherLayout(theme, roots.length, columns.length);
  openDelay.current = layout.openDelay;
  const { width: groupWidth, height: groupHeight } = layout;
  const selectedRootSlot = (rootIndex - rootStart + roots.length) % Math.max(1, roots.length);
  const rootCenter = layout.rootCenter(selectedRootSlot);
  const menuTops = columnTops(theme, rootCenter, columns.map(column => column.parent.children?.length ?? 0), selectedRowTops);
  const scale = Math.min(1, (viewport.width - 24) / groupWidth, (viewport.height - 24) / groupHeight);
  const groupLeft = Math.max(12, Math.min(viewport.width - groupWidth * scale - 12, anchor.x - layout.anchorX * scale));
  const groupTop = Math.max(12, Math.min(viewport.height - groupHeight * scale - 12, anchor.y - layout.anchorY * scale));
  const motion = !settings?.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tiltX = cursor ? Math.max(-1, Math.min(1, (cursor.x - anchor.x) / viewport.width)) * 7 : 0;
  const tiltY = cursor ? Math.max(-1, Math.min(1, (cursor.y - anchor.y) / viewport.height)) * -5 : 0;
  const launch = async (entry: MenuEntry) => {
    if (entry.kind === 'unsupported' && entry.reason === 'The original configuration has no action assigned.' && !entry.launcher && !entry.nativeTarget && !entry.directory) return;
    if (entry.kind === 'launcher' && entry.launcher) { try { await api.launch(entry.launcher); dismiss(); } catch (e) { notice(message(e), true); } }
    else if (entry.kind === 'settings') { setPreferences('options'); }
    else if (entry.kind === 'quit') { if (!runtime?.desktop) notice('Quit is available in the desktop application.', true); else void api.quit().catch(e => notice(message(e), true)); }
    else notice(entry.reason ?? 'This original Windows action is unavailable on this platform. Choose a native shortcut in Options.', true);
  };
  const selectRoot = (index: number) => {
    if (performance.now() < suppressRootClick.current) return;
    setRootIndex(index); setPath([]);
    if ((index - rootStart + roots.length) % roots.length >= layout.rootCapacity) setRootStart(index);
    if (index === rootIndex && rootOpened) { setRootOpened(false); return; }
    setRootOpened(true);
    if (roots[index]?.directory) void readDirectory(roots[index].directory);
    if (roots[index]?.kind !== 'menu') void launch(roots[index]);
  };
  const selectEntry = (entry: MenuEntry, depth: number) => {
    if (entry.kind === 'menu') { setPath(current => current[depth] === entry.id ? current.slice(0, depth) : [...current.slice(0, depth), entry.id]); if (entry.directory) void readDirectory(entry.directory); }
    else void launch(entry);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (starting || event.defaultPrevented) return;
      const target = event.target as HTMLElement;
      if (event.key === 'Escape') { event.preventDefault(); if (preferences) setPreferences(null); else if (target.matches('input,textarea')) target.blur(); else if (path.length) setPath(current => current.slice(0, -1)); else dismiss(); return; }
      if (target.matches('input,textarea,select') || target.isContentEditable || preferences || !menuVisible) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); if (path.length) setPath(current => current.slice(0, -1)); else document.querySelector<HTMLButtonElement>('.root-button.selected')?.focus(); }
      if (event.key === '/' && menuVisible) { event.preventDefault(); setPreferences('launcher'); }
      if (event.key === 'ArrowRight' && target.closest('.root-button')) { event.preventDefault(); document.querySelector<HTMLButtonElement>('.submenu-column button')?.focus(); }
    };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, [starting, preferences, path.length, dismiss, menuVisible]);

  const addFavorite = (item: LauncherItem) => {
    if (settingsRef.current?.favorites.some(existing => existing.target === item.target)) { notice(`${item.name} is already in Quick access.`); return; }
    save(s => ({ ...s, favorites: [...s.favorites, item], menu: addToQuickAccess(s.menu ?? fallbackMenu(runtime?.platform ?? 'web', apps, s.favorites), item) })); sound(); notice(`Added ${item.name} to Navigation → Quick access.`);
  };
  const pick = async (kind: 'application' | 'folder') => {
    setBusy(true); try { const item = await api.pickLauncher(kind); if (item) addFavorite(item); } catch (e) { notice(message(e), true); } finally { setBusy(false); }
  };
  const importConfiguration = async () => {
    setBusy(true); try {
      await saveQueue.current;
      const result = await api.importConfiguration();
      if (result) { revision.current++; persistedRef.current = result.settings; settingsRef.current = result.settings; setSettings(result.settings); setSaving(false); setSaveError(false); setRootIndex(0); setRootStart(0); setPath([]); notice(`Imported ${result.imported} shortcuts.${result.warnings.length ? ' ' + result.warnings.join(' ') : ''}`); }
    } catch (e) { notice(message(e), true); } finally { setBusy(false); }
  };
  const exportConfiguration = async () => {
    setBusy(true); try { await saveQueue.current; if (await api.exportConfiguration()) notice('Configuration exported.'); } catch (e) { notice(message(e), true); } finally { setBusy(false); }
  };

  if (!settings || !runtime) return <div className="initializing" role="status"><div className="initializing-circle"><img src={IMAGE + 'symbol/setting.png'} alt="" /></div>{bootError ? <><p>{bootError}</p><button onClick={() => location.reload()}>Try again</button></> : <><LoaderCircle className="spin" size={16} /><span>Initializing SAO menu…</span></>}</div>;
  return <LauncherThemeContext.Provider value={settings.theme}><div data-theme={settings.theme} className={`sao-desktop ${runtime.desktop ? 'native-desktop' : 'browser-preview'} ${settings.reducedMotion ? 'reduce-motion' : ''}`} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'link'; } }} onDrop={event => { event.preventDefault(); void api.dropFiles([...event.dataTransfer.files]).catch(error => notice(message(error), true)); }} onPointerDown={e => { if (!starting && (!e.target || !(e.target as HTMLElement).closest('.root-path,.submenu-column,.info-panel,.social-panel,.sao-dialog,.sao-notification')) && menuVisible && !preferences) dismiss(); }}>
    {starting && <LinkStart settings={settings} onComplete={() => { void api.completeStartup().then(() => { sound('ready'); setStarting(false); }).catch(error => notice(message(error), true)); }} />}
    <HandReticle pointer={handPointer} />
    {!starting && menuVisible && <main key={entrance} className={`original-menu ${leaving ? 'dismissing' : ''}`} aria-label="SAO menu" style={{ left: groupLeft, top: groupTop, width: groupWidth, height: groupHeight, transform: `scale(${scale})`, '--menu-scale': scale } as React.CSSProperties}>
      <div className="hologram-content" style={{ transformOrigin: `${layout.anchorX}px ${layout.anchorY}px`, transform: motion ? `perspective(1800px) rotateX(${tiltY}deg) rotateY(${tiltX}deg)` : undefined }}>
      {isGgo && <GgoRailTray left={layout.railLeft} top={layout.railTop} openDelay={layout.openDelay} />}
      {rootOpened && panelEntry?.infoPanel === true && (isGgo
        ? <GgoInfoPanel entry={panelEntry} playerName={account?.displayName ?? settings.playerName} left={0} top={ggoPanelTop(layout.railTop)} indicatorTop={ggoPanelIndicatorTop(layout.rootTop(selectedRootSlot))} onPopup={() => sound('popupPanel')} />
        : <InfoPanel entry={panelEntry} playerName={account?.displayName ?? settings.playerName} y={rootCenter - 215} onPopup={() => sound('popupPanel')} />)}
      <div className={`root-path ${rootOpened ? '' : 'unselected'}`} role="menu" aria-label="Categories" style={{ left: layout.railLeft, top: layout.railTop }} onWheel={e => { if (Math.abs(e.deltaY) > 1 && roots.length) { setRootStart((rootStart + (e.deltaY > 0 ? 1 : roots.length - 1)) % roots.length); setRootOpened(false); setPath([]); } }} onPointerDown={event => { if (event.button === 0) rootDrag.current = { y: event.clientY, index: rootStart, steps: 0 }; }} onPointerMove={event => { const drag = rootDrag.current; if (!drag) return; const steps = Math.trunc((event.clientY - drag.y) / (layout.rootPitch * scale)); if (steps !== drag.steps) { drag.steps = steps; event.currentTarget.setPointerCapture(event.pointerId); suppressRootClick.current = performance.now() + 300; setRootStart((drag.index - steps % roots.length + roots.length) % roots.length); setRootOpened(false); setPath([]); } }} onPointerUp={() => { rootDrag.current = null; }} onPointerCancel={() => { rootDrag.current = null; }}>
        {roots.map((entry, index) => {
          const slot = (index - rootStart + roots.length) % roots.length;
          if (slot >= layout.rootCapacity) return null;
          return <OriginalButton key={entry.id} entry={entry} root index={index} disabled={!layout.rootEnabled(slot)} hovered={hoveredButton === `root:${entry.id}`} selected={rootOpened && index === rootIndex} label={entry.id === 'user' ? account?.displayName ?? (settings.playerName || entry.name) : entry.name} style={{ top: layout.rootTop(slot), opacity: !rootOpened || index === rootIndex ? 1 : .5, animationDelay: `${layout.rootEntranceDelay(slot)}ms` }} onPress={() => sound()} onClick={() => selectRoot(index)} onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const next = (index + (e.key === 'ArrowDown' ? 1 : roots.length - 1)) % roots.length; selectRoot(next); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-root-index="${next}"]`)?.focus()); } }} />;
        })}
      </div>
      {rootOpened && !isGgo && columns.length > 0 && <MenuIndicator x={339} y={rootCenter} itemCount={columns[0].parent.children?.length ?? 0} hidden={!!columns[0].selected} />}
      {rootOpened && columns.map(({ parent, selected }, depth) => <Submenu key={depth} parent={parent} selected={selected} hoveredButton={hoveredButton} depth={depth} x={layout.menuLeft(depth)} y={menuTops[depth]} layout={submenuLayout(theme)} onSelectedTop={top => reportRowTop(depth, top)} onPress={() => sound()} onPopup={() => sound('popupMenu')} onBrowse={() => setPath(current => current.slice(0, depth))} onSelect={entry => selectEntry(entry, depth)} />)}
      {rootOpened && activeRoot?.social && <SocialPanel mode={activeRoot.social} x={layout.menuLeft(0)} y={rootCenter - 155} onPress={() => sound()} />}
      </div>
    </main>}
    {!menuVisible && !runtime.desktop && <button className="restore-button" onClick={() => { setMenuVisible(true); setRootIndex(0); setRootStart(0); setPath([]); }}><img src={IMAGE + 'symbol/setting.png'} alt="" /><span>Open SAO menu</span></button>}
    {preferences && <Preferences tab={preferences} onTab={setPreferences} onClose={() => setPreferences(null)} settings={settings} accountName={account?.displayName ?? settings.playerName} runtime={runtime} gesture={gesture} apps={apps} applicationError={applicationError} save={save} busy={busy} saving={saving} saveError={saveError} addFavorite={addFavorite} pick={pick} importConfiguration={importConfiguration} exportConfiguration={exportConfiguration} openPreview={async kind => { try { await (kind === "browser" ? api.openBrowser() : api.openMedia()); } catch (e) { notice(message(e), true); } }} enableGesture={async () => { try { const status = await (gesture?.permission === 'granted' ? api.getGestureStatus() : api.requestGesturePermission()); setGesture(status); notice(status.message, status.permission !== 'granted'); } catch (e) { notice(message(e), true); } }} launch={async item => { try { await api.launch(item); } catch (e) { notice(message(e), true); } }} />}
    {toast && <div role={toast.error ? 'alert' : 'status'} className={`sao-notification ${toast.error ? 'error' : ''}`}>{toast.error ? <Info size={18} /> : <Check size={18} />}<span>{toast.text}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={16} /></button></div>}
  </div></LauncherThemeContext.Provider>;
}

function OriginalButton({ entry, root = false, index = 0, hovered = false, selected = false, disabled = false, label, style, onPress, onClick, onKeyDown }: { entry: MenuEntry; root?: boolean; index?: number; hovered?: boolean; selected?: boolean; disabled?: boolean; label?: string; style?: React.CSSProperties; onPress: () => void; onClick: () => void; onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement> }) {
  const [focused, setFocused] = useState(false);
  const theme = useLauncherTheme();
  const normalIcon = iconPath(entry, root, index);
  const buttonStyle = { ...style, opacity: 1, '--background-opacity': style?.opacity ?? 1 } as React.CSSProperties;
  return <button type="button" role="menuitem" className={`${root ? 'root-button' : 'item-button'} ${hovered ? 'hovered' : ''} ${selected ? 'selected' : ''}`} style={buttonStyle} disabled={disabled || undefined} aria-label={label ?? entry.name} aria-haspopup={entry.kind === 'menu' ? 'menu' : undefined} aria-expanded={entry.kind === 'menu' ? selected : undefined} data-hover-id={`${root ? 'root' : 'item'}:${entry.id}`} data-root-index={root ? index : undefined} data-menu-item={!root ? entry.id : undefined} onFocus={event => setFocused(event.currentTarget.matches(':focus-visible'))} onBlur={() => setFocused(false)} onPointerDown={event => { if (event.button === 0) onPress(); }} onClick={onClick} onKeyDown={event => { if (!event.repeat && ['Enter', ' '].includes(event.key)) onPress(); onKeyDown?.(event); }}><ButtonIcon key={`${theme}:${normalIcon}`} icon={normalIcon} active={hovered || selected || focused} root={root} />{!root && <span>{entry.name}</span>}</button>;
}
function ButtonIcon({ icon, active, root }: { icon: string; active: boolean; root: boolean }) {
  const theme = useLauncherTheme();
  const [attempt, setAttempt] = useState(0);
  const [decoded, setDecoded] = useState('');
  const sources = themeIconSources(theme, icon, root);
  const vector = attempt === 0 && usesSaoVectorArt(theme) ? menuArtwork(icon, root) : null;
  const normal = vector?.normal ?? sources[Math.min(attempt, sources.length - 1)];
  const hovered = vector?.active ?? themeHoverSource(theme, normal);
  const useHover = active && decoded === hovered;
  return <div className={`original-icon-stack${vector && root ? ' vector-ring' : ''}`}><img className="original-icon" src={normal} alt="" draggable="false" style={{ opacity: useHover ? 0 : 1 }} onError={() => { if (attempt < sources.length - 1) setAttempt(attempt + 1); }} /><img className="original-icon" src={hovered} alt="" draggable="false" style={{ opacity: useHover ? 1 : 0 }} onLoad={event => { const image = event.currentTarget; void image.decode().then(() => setDecoded(hovered)).catch(() => {}); }} onError={() => setDecoded('')} /></div>;
}
function Submenu({ parent, selected, hoveredButton, depth, x, y, layout, onPress, onPopup, onBrowse, onSelect, onSelectedTop }: { parent: MenuEntry; selected?: string; hoveredButton: string | null; depth: number; x: number; y: number; layout: SubmenuLayout; onPress: () => void; onPopup: () => void; onBrowse: () => void; onSelect: (entry: MenuEntry) => void; onSelectedTop: (top: number) => void }) {
  const entries = parent.children ?? [];
  const [start, setStart] = useState(0);
  const isGgo = useLauncherTheme() === 'ggo';
  const count = Math.min(entries.length, layout.capacity);
  const selectedIndex = entries.findIndex(entry => entry.id === selected);
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; start: number; steps: number } | null>(null);
  const suppressClick = useRef(0);
  useEffect(() => { setStart(0); const timer = setTimeout(onPopup, layout.popupDelay); return () => clearTimeout(timer); }, [parent.id]);
  const isCentred = selectedIndex >= 0 && layout.recenterSelected;
  const visible = Array.from({ length: count }, (_, slot) => {
    const index = !isCentred ? (start + slot) % entries.length : (selectedIndex - Math.floor(count / 2) + slot + entries.length) % entries.length;
    return { entry: entries[index], top: layout.rowTop(slot, count, entries.length, isCentred) };
  });
  const selectedTop = visible.find(row => row.entry.id === selected)?.top;
  useLayoutEffect(() => { if (selectedTop !== undefined) onSelectedTop(selectedTop); }, [selectedTop]);
  const keyboard = (event: React.KeyboardEvent<HTMLButtonElement>, entry: MenuEntry) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); if (entry.kind === 'menu') { onSelect(entry); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-menu-depth="${depth + 1}"] button`)?.focus()); } }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = (entries.indexOf(entry) + (event.key === 'ArrowDown' ? 1 : entries.length - 1)) % entries.length;
      if (!visible.some(row => row.entry.id === entries[next].id)) setStart(next);
      requestAnimationFrame(() => container.current?.querySelector<HTMLButtonElement>(`[data-menu-item="${CSS.escape(entries[next].id)}"]`)?.focus());
    }
  };
  return <div className="submenu-column" data-menu-depth={depth} style={{ left: x, top: y, height: layout.height(entries.length) }} role="menu" aria-label={parent.name}>
    {isGgo && <GgoMenuTray />}
    <div className="submenu-mask" ref={container} onWheel={e => { if (entries.length > 1 && Math.abs(e.deltaY) > 1) { if (selected) onBrowse(); setStart(value => (value + (e.deltaY > 0 ? 1 : entries.length - 1)) % entries.length); } }} onPointerDown={event => { if (event.button === 0) drag.current = { y: event.clientY, start, steps: 0 }; }} onPointerMove={event => { const current = drag.current; if (!current || entries.length < 2) return; const steps = Math.trunc((event.clientY - current.y) / layout.pitch); if (steps !== current.steps) { current.steps = steps; event.currentTarget.setPointerCapture(event.pointerId); suppressClick.current = performance.now() + 300; if (selected) onBrowse(); setStart((current.start - steps % entries.length + entries.length) % entries.length); } }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      {visible.map(({ entry, top }) => <OriginalButton key={entry.id} entry={entry} hovered={hoveredButton === `item:${entry.id}`} selected={entry.id === selected} style={{ top, opacity: selected && entry.id !== selected ? .5 : 1 }} onPress={onPress} onClick={() => { if (performance.now() >= suppressClick.current) onSelect(entry); }} onKeyDown={e => keyboard(e, entry)} />)}
    </div>
    {selected && !isGgo && <MenuIndicator x={166} y={155} itemCount={entries.find(entry => entry.id === selected)?.children?.length ?? 0} />}
  </div>;
}
function MenuIndicator({ x, y, itemCount, hidden = false }: { x: number; y: number; itemCount: number; hidden?: boolean }) { const height = Math.max(70, Math.min(230, itemCount * 44 + 2)); return <div className={`menu-indicator ${hidden ? 'hidden' : ''}`} style={{ left: x, top: y - height / 2, height }} aria-hidden="true"><span className="indicator-upper" /><span className="indicator-lower" /></div>; }
function InfoPanel({ entry, playerName, y, onPopup }: { entry: MenuEntry; playerName: string; y: number; onPopup: () => void }) {
  useEffect(() => { onPopup(); }, []);
  const description = entry.description;
  const image = entry.image?.replace(/^\.\.\/Images\//, '').replace(/^Images\//, '') ?? (entry.id === 'user' ? 'etc/info.png' : 'icon/default.png');
  return <section className={`info-panel ${description ? 'expanded' : 'collapsed'}`} style={{ top: y }} aria-label={`${entry.name} information`}><div className="panel-art"><h1>{entry.id === 'user' ? playerName || entry.name : entry.name}</h1><img className="panel-illustration" src={IMAGE + image} alt="" onError={e => { e.currentTarget.src = IMAGE + 'icon/default.png'; }} />{description && <p>{description}</p>}</div><img className="panel-shadow" src={IMAGE + 'etc/panel-shadow.png'} alt="" /></section>;
}

interface PreferencesProps { tab: Tab; onTab: (tab: Tab) => void; onClose: () => void; settings: Settings; accountName: string; runtime: RuntimeInfo; gesture: GestureStatus | null; apps: LauncherItem[]; applicationError: string; save: (change: Partial<Settings> | ((s: Settings) => Settings)) => void; busy: boolean; saving: boolean; saveError: boolean; addFavorite: (item: LauncherItem) => void; pick: (kind: 'application' | 'folder') => Promise<void>; importConfiguration: () => Promise<void>; exportConfiguration: () => Promise<void>; enableGesture: () => Promise<void>; openPreview: (kind: "browser" | "media") => Promise<void>; launch: (item: LauncherItem) => Promise<void> }
function Preferences({ tab, onTab, onClose, settings, accountName, runtime, gesture, apps, applicationError, save, busy, saving, saveError, addFavorite, pick, importConfiguration, exportConfiguration, enableGesture, openPreview, launch }: PreferencesProps) {
  const [query, setQuery] = useState(''); const [linkDialog, setLinkDialog] = useState(false); const [library, setLibrary] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement; dialog.current?.querySelector<HTMLButtonElement>('button')?.focus(); return () => previous?.focus(); }, []);
  const launcherItems = (query ? [...settings.favorites, ...apps.filter(app => !settings.favorites.some(f => f.target === app.target))] : library ? apps : settings.favorites).filter(item => item.name.toLowerCase().includes(query.toLowerCase()) || item.target.toLowerCase().includes(query.toLowerCase()));
  return <div className="dialog-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="sao-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="options-title" onKeyDown={e => trapFocus(e, dialog.current)}><header className="dialog-title"><h2 id="options-title">SAO Utils 2 · {tab === 'options' ? 'Options' : tab === 'launcher' ? 'Launcher' : 'About'}</h2><button className="dialog-close" aria-label="Close options" onClick={onClose}><X size={19} /></button></header><nav className="dialog-tabs" aria-label="Options categories">{(['options', 'launcher', 'about'] as Tab[]).map(value => <button className={tab === value ? 'active' : ''} aria-current={tab === value ? 'page' : undefined} key={value} onClick={() => onTab(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</nav><div className="dialog-content">
    {tab === 'options' && <div className="options-grid"><section><h3>Interface</h3><label className="preference-field"><span>Display name</span><input value={accountName} readOnly aria-label="Account display name" /></label><Preference title="Sound effects" text="Use the bundled SAO interface sounds."><Toggle label="Sound effects" value={settings.sound} onChange={() => save({ sound: !settings.sound })} /></Preference><Preference title="Reduce motion" text="System motion preferences are also respected."><Toggle label="Reduce motion" value={settings.reducedMotion} onChange={() => save({ reducedMotion: !settings.reducedMotion })} /></Preference><Preference title="Always on top" text="Keep the launcher above other windows."><Toggle label="Always on top" value={settings.alwaysOnTop} disabled={!runtime.desktop} onChange={() => save({ alwaysOnTop: !settings.alwaysOnTop })} /></Preference><Preference title="Launch at login" text="Start in the system tray."><Toggle label="Launch at login" value={settings.launchAtLogin} disabled={!runtime.desktop} onChange={() => save({ launchAtLogin: !settings.launchAtLogin })} /></Preference><label className="preference-field"><span>Theme</span><ThemeSelect value={settings.theme} onChange={theme => save({ theme })} /></label><label className="preference-field shortcut-field"><span>Menu shortcut<small>{runtime.shortcutRegistered ? 'Global shortcut · saved on blur' : runtime.desktop ? 'Shortcut not registered; choose another combination.' : 'Available in the desktop app'}</small></span><Shortcut value={settings.shortcut} onSave={shortcut => save({ shortcut })} disabled={!runtime.desktop} /></label></section><section><h3>Mouse gesture</h3><p className="preference-description">Hold the primary and secondary mouse buttons together, then drag down to open the menu at your cursor.</p><div className="gesture-status"><span className={gesture?.running ? 'ready-dot' : ''} />{gesture?.running ? 'Gesture listener active' : gesture?.permission === 'denied' ? 'Input Monitoring permission required' : 'Gesture listener unavailable'}</div><p className="preference-description">{gesture?.message ?? 'Checking gesture support…'}</p><button className="dialog-button" disabled={!runtime.desktop || !gesture?.supported} onClick={() => void enableGesture()}>{gesture?.permission === 'granted' ? 'Refresh gesture status' : 'Enable mouse gesture'}<ArrowRight size={14} /></button><h3 className="configuration-heading">Hand gestures</h3><Preference title="Camera hand gestures" text="Two fingers, swipe down to open. Point to aim, push forward to select. Open hand, swipe sideways to close."><Toggle label="Camera hand gestures" value={settings.handTracking} disabled={!runtime.desktop} onChange={() => save({ handTracking: !settings.handTracking })} /></Preference><HandTrackingStatusLine isDesktop={runtime.desktop} isEnabled={settings.handTracking} /><Preference title="Camera debug view" text="Show the camera with hand landmarks and the detected pose, for checking tracking."><Toggle label="Camera debug view" value={settings.handDebugView} disabled={!runtime.desktop || !settings.handTracking} onChange={() => save({ handDebugView: !settings.handDebugView })} /></Preference><h3 className="configuration-heading">Browser and media</h3><div className="dialog-actions-inline"><button className="dialog-button" disabled={!runtime.desktop} onClick={() => void openPreview("browser")}>Web Browser</button><button className="dialog-button" disabled={!runtime.desktop} onClick={() => void openPreview("media")}>Images / Video</button></div><h3 className="configuration-heading">Configuration</h3><p className="preference-description">Import the original SAO Utils 2 menu.xml or a desktop backup. Unsupported Windows actions are shown with an explanation.</p><div className="dialog-actions-inline"><button className="dialog-button" disabled={busy || !runtime.desktop} onClick={() => void importConfiguration()}><Upload size={14} /> Import</button><button className="dialog-button" disabled={busy || !runtime.desktop} onClick={() => void exportConfiguration()}><Download size={14} /> Export</button></div><button className="reset-menu" onClick={() => save({ menu: undefined })}>Restore bundled menu hierarchy</button>{!runtime.desktop && <p className="preview-explanation">Browser preview: native controls, gestures, file import, and app launching are available in the desktop build.</p>}</section></div>}
    {tab === 'launcher' && <div className="launcher-editor"><div className="editor-topline"><div className="editor-tabs"><button className={!library ? 'active' : ''} onClick={() => setLibrary(false)}>Quick access ({settings.favorites.length})</button><button className={library ? 'active' : ''} onClick={() => setLibrary(true)}>Applications ({apps.length})</button></div><label className="editor-search"><Search size={14} /><input autoFocus aria-label="Search applications and shortcuts" placeholder="Search…" value={query} onChange={e => setQuery(e.target.value)} /></label></div><div className="editor-list">{launcherItems.length ? launcherItems.map(item => <div className="editor-item" key={item.id}><img src={IMAGE + (item.kind === 'folder' ? 'item/folder.png' : item.kind === 'url' ? 'item/web.png' : 'item/file.png')} alt="" onError={e => { e.currentTarget.src = IMAGE + 'item/help.png'; }} /><button className="editor-launch" onClick={() => void launch(item)}><strong>{item.name}</strong><span>{item.target}</span></button>{settings.favorites.some(f => f.target === item.target) ? <button aria-label={`Remove ${item.name} from quick access`} className="editor-item-action" onClick={() => save(s => ({ ...s, favorites: s.favorites.filter(f => f.target !== item.target), menu: removeQuickAccess(s.menu, item.id) }))}><X size={15} /></button> : <button aria-label={`Add ${item.name} to quick access`} className="editor-item-action" onClick={() => addFavorite(item)}><Plus size={15} /></button>}</div>) : <p className="editor-empty">{query ? 'No matching shortcuts.' : library ? applicationError || 'Installed applications are available in the desktop build.' : 'Add apps, folders, or web links to your quick access menu.'}</p>}</div><div className="editor-add"><span>Add shortcut</span><button className="dialog-button" disabled={busy || !runtime.desktop} onClick={() => void pick('application')}><Plus size={14} /> Application</button><button className="dialog-button" disabled={busy || !runtime.desktop} onClick={() => void pick('folder')}><Folder size={14} /> Folder</button><button className="dialog-button" onClick={() => setLinkDialog(true)}><Link size={14} /> Web link</button></div><p className="preference-description">New shortcuts appear under Navigation → Quick access. Original menu entries keep their hierarchy.</p></div>}
    {tab === 'about' && <div className="about-options"><img src={IMAGE + 'etc/info.png'} alt="Original SAO info panel illustration" /><div><h3>SAO Utils 2 · Desktop port</h3><p>This local port uses the original bundled SAO theme artwork, font, menu hierarchy, and interface sounds. The desktop shell adapts app launching, folders, global shortcuts, and mouse gestures for {platformName(runtime.platform)}.</p><p>Version {runtime.version} · {platformName(runtime.platform)}</p><p>SAO vector icons and UI typeface by darkblackswords, from the supplied fan-art collection.</p><Updates automatic={settings.automaticUpdates} onAutomatic={() => save({ automaticUpdates: !settings.automaticUpdates })} /><p>The original Windows NERvGear/Qt plugins and executable actions require platform-specific replacements; unsupported actions are clearly marked when imported.</p><p className="preference-description">Original assets retain their original rights and are imported locally from your licensed bundle. This is an independent port; it is not an official SAO Utils release.</p></div></div>}
  </div><footer className="dialog-footer"><span role="status">{saving ? 'Saving…' : saveError ? 'Last change was not saved' : 'Configuration saved'}</span><button className="original-confirm" aria-label="Close options" onClick={onClose}><img src={IMAGE + 'icon/ok.png'} alt="" /></button><span>Esc to close</span></footer>{linkDialog && <LinkDialog onClose={() => setLinkDialog(false)} onAdd={item => { addFavorite(item); setLinkDialog(false); }} />}</div></div>;
}
function addToQuickAccess(menu: MenuEntry[], item: LauncherItem): MenuEntry[] {
  const leaf: MenuEntry = item.kind === 'folder' ? { id: item.id, name: item.name, kind: 'menu', directory: item.target, children: [], icon: 'item/folder.png' } : { id: item.id, name: item.name, kind: 'launcher', launcher: item, icon: 'item/file.png' };
  const append = (root: MenuEntry): MenuEntry => { const children = root.children ?? []; const existing = children.find(child => child.id === 'desktop.quickaccess'); const group: MenuEntry = existing ? { ...existing, children: [...(existing.children ?? []), leaf] } : { id: 'desktop.quickaccess', name: 'Quick access', kind: 'menu', icon: 'item/folder.png', children: [leaf] }; return { ...root, children: existing ? children.map(child => child.id === group.id ? group : child) : [...children, group] }; };
  const navigation = menu.find(root => root.id === 'navigation');
  return navigation ? menu.map(root => root.id === navigation.id ? append(root) : root) : [...menu, append({ id: 'navigation', name: 'Navigation', kind: 'menu', icon: 'symbol/navi.png', children: [] })];
}
function removeQuickAccess(menu: MenuEntry[] | undefined, id: string): MenuEntry[] | undefined { return menu?.map(root => ({ ...root, children: root.children?.map(child => child.id === 'desktop.quickaccess' ? { ...child, children: child.children?.filter(leaf => leaf.id !== id) } : child) })); }
function ThemeSelect({ value, onChange }: { value: ThemeId; onChange: (theme: ThemeId) => void }) { return <select className="theme-select" aria-label="Launcher theme" value={value} onChange={e => onChange(e.target.value as ThemeId)}>{THEME_IDS.map(id => <option key={id} value={id}>{THEME_NAMES[id]}</option>)}</select>; }
function Preference({ title, text, icon, children }: { title: string; text: string; icon?: React.ReactNode; children: React.ReactNode }) { return <div className="preference-row">{icon}<div><strong>{title}</strong><p>{text}</p></div>{children}</div>; }
function Toggle({ label, value, disabled, onChange }: { label: string; value: boolean; disabled?: boolean; onChange: () => void }) { return <button className={`preference-toggle ${value ? 'checked' : ''}`} role="switch" aria-label={label} aria-checked={value} disabled={disabled} onClick={onChange}><span /></button>; }
function Shortcut({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (value: string) => void }) { const [draft, setDraft] = useState(value); useEffect(() => setDraft(value), [value]); return <input aria-label="Menu shortcut" className="shortcut-input" value={draft} disabled={disabled} onChange={e => setDraft(e.target.value)} onBlur={() => { if (draft.trim()) onSave(draft.trim()); else setDraft(value); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />; }
function trapFocus(event: React.KeyboardEvent, element: HTMLElement | null) { if (event.key !== 'Tab') return; const buttons = element?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]'); if (!buttons?.length) return; const first = buttons[0]; const last = buttons[buttons.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
function LinkDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (item: LauncherItem) => void }) {
  const [name, setName] = useState(''); const [url, setURL] = useState(''); const [error, setError] = useState(''); const element = useRef<HTMLDivElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement; element.current?.querySelector<HTMLInputElement>('input')?.focus(); return () => previous?.focus(); }, []);
  return <div className="link-scrim"><div className="link-dialog" ref={element} role="dialog" aria-modal="true" aria-labelledby="link-title" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose(); else trapFocus(e, element.current); }}><h3 id="link-title">Add a web link</h3><form onSubmit={e => { e.preventDefault(); try { const address = new URL(url); if (!['http:', 'https:'].includes(address.protocol) || address.username || address.password) throw new Error('Use an HTTP or HTTPS address without credentials.'); if (!name.trim()) throw new Error('Enter a shortcut name.'); onAdd({ id: crypto.randomUUID(), name: name.trim(), kind: 'url', target: address.href }); } catch (error) { setError(error instanceof TypeError ? 'Enter a full address, such as https://example.com.' : message(error)); } }}><label>Name<input value={name} maxLength={80} required onChange={e => setName(e.target.value)} placeholder="Shortcut name" /></label><label>Web address<input type="url" value={url} required onChange={e => setURL(e.target.value)} placeholder="https://example.com" /></label>{error && <p role="alert" className="form-error">{error}</p>}<div className="dialog-actions-inline"><button type="button" className="dialog-button" onClick={onClose}>Cancel</button><button type="submit" className="dialog-button orange">Add shortcut <Plus size={14} /></button></div></form></div></div>;
}

createRoot(document.getElementById('root')!).render(window.saoHP ? <HpHudWindow /> : window.saoSurface ? <SurfaceApp /> : <App />);
