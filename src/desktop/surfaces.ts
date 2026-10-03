import { BrowserWindow, dialog, ipcMain, protocol, screen, session, shell, type IpcMainInvokeEvent } from 'electron';
import { createReadStream } from 'node:fs';
import { readdir, realpath, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { browserURL, mediaKind, type SurfaceState, type SurfaceInput, type BrowserFrame } from '../shared/surfaces';
import { defaultPresentation, normalizeGallery, normalizePresentation, type SurfaceLayout } from '../shared/surface-layout';
import { SurfaceLayoutStore } from './surface-store';
import { displayFrameRate, pointerInterval } from '../shared/refresh';

interface Surface { view: BrowserWindow; remote?: BrowserWindow; state: SurfaceState; token?: string; galleryTokens: string[]; source: string; frame?: BrowserFrame; framePending?: boolean; frameInFlight?: boolean; url: string }
const contentWidth = 1000;
const contentHeight = 640;
const mime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', ogv: 'video/ogg' };

/** Isolated remote pages never receive the local desktop or surface bridge. */
export class SurfaceManager {
  private surfaces = new Map<number, Surface>();
  private files = new Map<string, string>();
  private pointer: ReturnType<typeof setInterval> | null = null;
  private pointerDelay = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private restoring = false;
  private stopping = false;
  constructor(private readonly rendererURL: string, private readonly preload: string, private readonly reducedMotion: () => boolean, private readonly store: SurfaceLayoutStore) {}

  install(): void {
    const owner = (event: Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>) => {
      const surface = this.surfaces.get(event.sender.id);
      if (!surface || event.senderFrame !== event.sender.mainFrame || event.senderFrame?.url !== surface.url) throw new Error('Untrusted surface sender.');
      return surface;
    };
    ipcMain.handle('sao:surface:state', event => {
      const surface = owner(event);
      if (surface.frame) { surface.framePending = true; this.sendFrame(surface); }
      return { ...surface.state };
    });
    ipcMain.on('sao:surface:frame:ack', event => {
      try { const surface = owner(event); surface.frameInFlight = false; this.sendFrame(surface); } catch { /* Untrusted or already closed renderer. */ }
    });
    ipcMain.handle('sao:surface:navigate', (event, url) => this.navigate(owner(event), browserURL(url)));
    ipcMain.handle('sao:surface:command', async (event, command) => {
      const surface = owner(event); const contents = surface.remote?.webContents;
      switch (command) {
        case 'close': setTimeout(() => { if (!surface.view.isDestroyed()) surface.view.close(); }, 80); return;
        case 'back': if (contents?.navigationHistory.canGoBack()) contents.navigationHistory.goBack(); return;
        case 'forward': if (contents?.navigationHistory.canGoForward()) contents.navigationHistory.goForward(); return;
        case 'reload': contents?.reload(); return;
        case 'stop': contents?.stop(); return;
        case 'external':
          if (contents && surface.state.url !== 'about:blank') await shell.openExternal(browserURL(surface.state.url));
          else if (surface.token && this.files.has(surface.token)) {
            const file = this.files.get(surface.token)!;
            if (await realpath(file) !== file || mediaKind(file) !== surface.state.kind || !(await stat(file)).isFile()) throw new Error('The selected media file has changed.');
            const error = await shell.openPath(file);
            if (error) throw new Error(error);
          }
          return;
        case 'change': await this.changeMedia(surface); return;
        case 'refresh': if (surface.state.kind !== 'gallery') throw new Error('This is not a gallery.'); await this.refreshGallery(surface); return;
        default: throw new Error('Unsupported browser command.');
      }
    });
    ipcMain.handle('sao:surface:drop', (event, paths) => this.dropFiles(paths, owner(event)));
    ipcMain.handle('sao:surface:presentation', (event, value) => {
      const surface = owner(event);
      if (!['image', 'video'].includes(surface.state.kind)) throw new Error('This is not a media preview.');
      surface.state.presentation = normalizePresentation(value); this.publish(surface); this.scheduleSave();
    });
    ipcMain.handle('sao:surface:gallery', (event, value) => {
      const surface = owner(event);
      if (!surface.state.gallery) throw new Error('This is not a gallery.');
      surface.state.gallery.settings = normalizeGallery(value); this.publish(surface); this.scheduleSave();
    });
    ipcMain.handle('sao:surface:input', (event, input) => this.input(owner(event), input));
    ipcMain.handle('sao:surface:resize', (event, width, height) => {
      const surface = owner(event);
      if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error('Invalid surface size.');
      const area = screen.getDisplayMatching(surface.view.getBounds()).workArea;
      surface.view.setSize(Math.round(Math.max(180, Math.min(area.width, width))), Math.round(Math.max(120, Math.min(area.height, height))));
    });
    ipcMain.handle('sao:surface:move', (event, dx, dy) => {
      const surface = owner(event);
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 5000 || Math.abs(dy) > 5000) throw new Error('Invalid surface movement.');
      const bounds = surface.view.getBounds(); const area = screen.getDisplayNearestPoint({ x: bounds.x + dx, y: bounds.y + dy }).workArea;
      surface.view.setPosition(Math.round(Math.max(area.x - bounds.width + 80, Math.min(area.x + area.width - 80, bounds.x + dx))), Math.round(Math.max(area.y, Math.min(area.y + area.height - 40, bounds.y + dy))));
    });
    protocol.handle('sao-media', async request => {
      const url = new URL(request.url); const file = this.files.get(url.pathname.slice(1));
      if (url.hostname !== 'preview' || !file) return new Response('Unknown preview', { status: 404 });
      try {
        if (await realpath(file) !== file) return new Response('Preview changed', { status: 403 });
        const info = await stat(file);
        const range = request.headers.get('range');
        let start = 0, end = info.size - 1;
        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range);
          if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
          if (match[1]) { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
          else start = Math.max(0, info.size - Number(match[2]));
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
        }
        const headers: Record<string, string> = { 'Content-Type': mime[path.extname(file).slice(1).toLowerCase()], 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' };
        if (range) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
        if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
        if (request.method !== 'GET') return new Response(null, { status: 405 });
        return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers });
      } catch { return new Response('Preview unavailable', { status: 404 }); }
    });
    screen.on('display-metrics-changed', this.refreshRates);
    screen.on('display-added', this.refreshRates); screen.on('display-removed', this.refreshRates);
    this.refreshRates();
  }

  private sendFrame(surface: Surface): void {
    // One frame in flight, one latest frame retained: slow renderers never
    // accumulate image IPC messages or decode work from older page frames.
    if (!surface.frame || !surface.framePending || surface.frameInFlight || surface.view.isDestroyed() || !surface.view.isVisible()) return;
    surface.frameInFlight = true; surface.framePending = false;
    surface.view.webContents.send('sao:surface:frame', surface.frame);
  }
  private refreshRates = () => {
    let frequency = displayFrameRate(screen.getPrimaryDisplay().displayFrequency);
    for (const surface of this.surfaces.values()) {
      if (surface.view.isDestroyed()) continue;
      const target = displayFrameRate(screen.getDisplayMatching(surface.view.getBounds()).displayFrequency);
      if (surface.view.isVisible()) frequency = Math.max(frequency, target);
      if (surface.remote && !surface.remote.isDestroyed()) surface.remote.webContents.setFrameRate(target);
    }
    const delay = pointerInterval(frequency);
    if (this.pointer && this.pointerDelay === delay) return;
    if (this.pointer) clearInterval(this.pointer); this.pointerDelay = delay;
    this.pointer = setInterval(() => {
      const point = screen.getCursorScreenPoint(), reducedMotion = this.reducedMotion();
      for (const surface of this.surfaces.values()) {
        if (surface.view.isDestroyed()) continue;
        if (surface.state.reducedMotion !== reducedMotion) { surface.state.reducedMotion = reducedMotion; this.publish(surface); }
        if (reducedMotion || !surface.view.isVisible()) continue;
        const bounds = surface.view.getBounds();
        surface.view.webContents.send('sao:surface:pointer', { x: point.x - bounds.x, y: point.y - bounds.y });
      }
    }, delay); this.pointer.unref();
  };

  async openBrowser(url = 'about:blank'): Promise<void> {
    return this.createBrowser(url);
  }
  private async createBrowser(url: string, layout?: SurfaceLayout): Promise<void> {
    const surface = await this.create('browser', 'Web Browser', '', 1080, 740, undefined, layout);
    const browserSession = session.fromPartition('persist:sao-web-browser');
    browserSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    browserSession.setPermissionCheckHandler(() => false);
    const remote = new BrowserWindow({ width: contentWidth, height: contentHeight, show: false, frame: false,
      webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: false, session: browserSession } });
    surface.remote = remote;
    this.refreshRates();
    remote.webContents.setWindowOpenHandler(({ url }) => {
      try { void this.openBrowser(browserURL(url)).catch(() => {}); } catch { /* Non-web popups are rejected. */ }
      return { action: 'deny' };
    });
    remote.webContents.on('will-navigate', (event, address) => { try { browserURL(address); } catch { event.preventDefault(); } });
    remote.webContents.on('will-redirect', (event, address) => { try { browserURL(address); } catch { event.preventDefault(); } });
    remote.webContents.on('will-attach-webview', event => event.preventDefault());
    remote.webContents.on('paint', (_event, _dirty, image) => {
      if (surface.view.isDestroyed()) return;
      // Native bitmap may be Retina-sized. Normalize to page coordinates.
      const normalized = image.resize({ width: contentWidth, height: contentHeight });
      surface.frame = { pixels: normalized.toBitmap(), width: contentWidth, height: contentHeight };
      surface.framePending = true; this.sendFrame(surface);
    });
    const update = () => {
      surface.state.url = remote.webContents.getURL() || 'about:blank';
      surface.state.title = remote.webContents.getTitle() || 'Web Browser';
      surface.state.loading = remote.webContents.isLoading();
      surface.state.canGoBack = remote.webContents.navigationHistory.canGoBack();
      surface.state.canGoForward = remote.webContents.navigationHistory.canGoForward();
      this.publish(surface); this.scheduleSave();
    };
    remote.webContents.on('did-start-loading', () => { surface.state.error = ''; update(); });
    remote.webContents.on('did-stop-loading', update);
    remote.webContents.on('did-navigate', update);
    remote.webContents.on('did-navigate-in-page', update);
    remote.webContents.on('page-title-updated', update);
    remote.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => { if (isMainFrame && code !== -3) { surface.state.error = description; this.publish(surface); } });
    const navigation = this.navigate(surface, browserURL(url));
    if (layout) void navigation.catch(error => { surface.state.error = String(error); this.publish(surface); });
    else await navigation;
  }

  async openMedia(file: string): Promise<void> {
    return this.createMedia(file);
  }
  private async createMedia(file: string, layout?: SurfaceLayout): Promise<void> {
    const canonical = await realpath(file); const kind = mediaKind(canonical);
    if (!kind || !(await stat(canonical)).isFile()) throw new Error('Choose a supported image or video.');
    const token = randomUUID(); this.files.set(token, canonical);
    try {
      const surface = await this.create(kind, path.basename(canonical), `sao-media://preview/${token}`, 560, 370, token, layout);
      surface.source = canonical; this.scheduleSave();
    } catch (error) { this.files.delete(token); throw error; }
  }

  async pickMedia(parent: BrowserWindow): Promise<void> {
    const result = await dialog.showOpenDialog(parent, { title: 'Preview images and videos', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Images and videos', extensions: Object.keys(mime) }] });
    if (result.canceled) return;
    for (const file of result.filePaths.slice(0, 12)) await this.openMedia(file);
  }

  async pickGallery(parent: BrowserWindow): Promise<void> {
    const result = await dialog.showOpenDialog(parent, { title: 'Image Folder', properties: ['openDirectory'] });
    if (!result.canceled && result.filePaths[0]) await this.openGallery(result.filePaths[0]);
  }
  async openGallery(folder: string, layout?: SurfaceLayout): Promise<void> {
    const canonical = await realpath(folder);
    if (!(await stat(canonical)).isDirectory()) throw new Error('Choose an image folder.');
    const surface = await this.create('gallery', 'Gallery Widget', '', 560, 370, undefined, layout);
    surface.source = canonical;
    surface.state.gallery = { images: [], settings: normalizeGallery(layout?.gallery), revision: 0 };
    try { await this.refreshGallery(surface); this.scheduleSave(); }
    catch (error) { surface.view.close(); throw error; }
  }
  async dropFiles(raw: unknown, surface?: Surface): Promise<void> {
    if (!Array.isArray(raw) || !raw.length || raw.length > 12 || raw.some(file => typeof file !== 'string' || !path.isAbsolute(file) || file.length > 4096 || /[\u0000-\u001f]/.test(file))) throw new Error('Drop local image or video files.');
    if (surface?.state.kind === 'browser') throw new Error('Drop media on the launcher or a media preview.');
    if (surface?.state.kind === 'gallery') {
      const folder = await realpath(raw[0]);
      if (!(await stat(folder)).isDirectory()) throw new Error('Drop an image folder on the gallery.');
      const previous = surface.source; surface.source = folder;
      try { await this.refreshGallery(surface); } catch (error) { surface.source = previous; throw error; }
      this.scheduleSave(); return;
    }
    if (surface) { await this.replaceMedia(surface, raw[0]); return; }
    // Validate the entire selection before creating any window.
    const files = await Promise.all(raw.map(async file => {
      const canonical = await realpath(file);
      if (!mediaKind(canonical) || !(await stat(canonical)).isFile()) throw new Error('Choose supported image or video files.');
      return canonical;
    }));
    if (this.surfaces.size + files.length > 12) throw new Error('Close a preview before opening another.');
    for (const file of files) await this.openMedia(file);
  }
  async restore(): Promise<void> {
    this.restoring = true;
    try {
      for (const layout of await this.store.load()) {
        try {
          if (layout.kind === 'browser') await this.createBrowser(layout.source, layout);
          else if (layout.kind === 'gallery') await this.openGallery(layout.source, layout);
          else await this.createMedia(layout.source, layout);
        } catch (error) { console.warn('A saved preview could not be restored.', error instanceof Error ? error.message : error); }
      }
    } finally { this.restoring = false; await this.flush(); }
  }
  async flush(): Promise<void> {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    const layouts = [...this.surfaces.values()].map(surface => ({ kind: surface.state.kind, source: surface.state.kind === 'browser' ? surface.state.url : surface.source, bounds: surface.view.getBounds(), presentation: surface.state.presentation, gallery: surface.state.gallery?.settings }));
    await this.store.save(layouts);
  }
  private scheduleSave(): void {
    if (this.stopping || this.restoring) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.saveTimer = null; void this.flush().catch(error => console.warn('Preview layout could not be saved.', error)); }, 350);
  }

  stop(): void {
    this.stopping = true;
    if (this.pointer) clearInterval(this.pointer);
    screen.removeListener('display-metrics-changed', this.refreshRates); screen.removeListener('display-added', this.refreshRates); screen.removeListener('display-removed', this.refreshRates);
    if (this.saveTimer) clearTimeout(this.saveTimer);
    for (const surface of [...this.surfaces.values()]) surface.view.destroy();
    this.files.clear();
  }

  private async changeMedia(surface: Surface): Promise<void> {
    if (surface.state.kind === 'gallery') {
      const result = await dialog.showOpenDialog(surface.view, { title: 'Image Folder', properties: ['openDirectory'] });
      if (!result.canceled && result.filePaths[0] && !surface.view.isDestroyed()) await this.dropFiles([result.filePaths[0]], surface);
      return;
    }
    if (surface.remote || !surface.token) throw new Error('This is not a media preview.');
    const result = await dialog.showOpenDialog(surface.view, {
      title: surface.state.kind === 'image' ? 'Change Image' : 'Change Video', properties: ['openFile'],
      filters: [{ name: surface.state.kind === 'image' ? 'Images' : 'Videos', extensions: Object.keys(mime).filter(extension => mediaKind(`file.${extension}`) === surface.state.kind) }],
    });
    if (result.canceled || !result.filePaths[0] || surface.view.isDestroyed()) return;
    await this.replaceMedia(surface, result.filePaths[0]);
  }
  private async replaceMedia(surface: Surface, selected: string): Promise<void> {
    if (!surface.token) throw new Error('This is not a media preview.');
    const file = await realpath(selected);
    if (mediaKind(file) !== surface.state.kind || !(await stat(file)).isFile()) throw new Error('Choose a supported file of the same media type.');
    const token = randomUUID(); this.files.set(token, file); this.files.delete(surface.token);
    surface.token = token; surface.state.url = `sao-media://preview/${token}`; surface.state.title = path.basename(file);
    surface.source = file; surface.state.restored = false;
    surface.view.setTitle(surface.state.title); this.publish(surface); this.scheduleSave();
  }

  private async refreshGallery(surface: Surface): Promise<void> {
    if (!surface.state.gallery || await realpath(surface.source) !== surface.source) throw new Error('The image folder has changed.');
    const entries = (await readdir(surface.source, { withFileTypes: true })).filter(entry => entry.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(entry.name)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 512);
    const tokens: string[] = []; const images = [];
    for (const entry of entries) {
      const file = path.join(surface.source, entry.name);
      try {
        if (await realpath(file) !== file || !(await stat(file)).isFile()) continue;
        const token = randomUUID(); this.files.set(token, file); tokens.push(token);
        images.push({ title: entry.name, url: `sao-media://preview/${token}` });
      } catch { /* Disappearing entries are omitted. */ }
    }
    if (surface.view.isDestroyed()) { for (const token of tokens) this.files.delete(token); return; }
    for (const token of surface.galleryTokens) this.files.delete(token);
    surface.galleryTokens = tokens;
    surface.state.gallery.images = images; surface.state.gallery.revision++;
    this.publish(surface);
  }

  private async create(kind: SurfaceState['kind'], title: string, source: string, width: number, height: number, token?: string, layout?: SurfaceLayout): Promise<Surface> {
    if (this.surfaces.size >= 12) throw new Error('Close a preview before opening another.');
    const id = randomUUID(); const location = new URL(this.rendererURL);
    location.searchParams.set('surface', id);
    const cursor = screen.getCursorScreenPoint(); const area = (layout ? screen.getDisplayMatching(layout.bounds) : screen.getDisplayNearestPoint(cursor)).workArea;
    const offset = (this.surfaces.size % 5) * 34;
    width = Math.min(layout?.bounds.width ?? width, area.width); height = Math.min(layout?.bounds.height ?? height, area.height);
    const view = new BrowserWindow({ width, height, minWidth: 180, minHeight: 120,
      x: Math.round(layout ? Math.max(area.x, Math.min(area.x + area.width - width, layout.bounds.x)) : area.x + (area.width - width) / 2 + Math.min(offset, (area.width - width) / 2)),
      y: Math.round(layout ? Math.max(area.y, Math.min(area.y + area.height - height, layout.bounds.y)) : area.y + (area.height - height) / 2 + Math.min(offset, (area.height - height) / 2)),
      show: false, frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false, resizable: true,
      title, autoHideMenuBar: true, alwaysOnTop: true,
      webPreferences: { preload: this.preload, nodeIntegration: false, sandbox: true, contextIsolation: true, webSecurity: true, autoplayPolicy: 'no-user-gesture-required' } });
    const surface: Surface = { view, token, galleryTokens: [], source: layout?.source ?? '', url: location.href, state: { id, kind, title, url: source, loading: false, error: '', canGoBack: false, canGoForward: false, reducedMotion: this.reducedMotion(), restored: !!layout, presentation: layout?.presentation ?? { ...defaultPresentation } } };
    const senderId = view.webContents.id;
    this.surfaces.set(senderId, surface);
    view.on('page-title-updated', event => event.preventDefault());
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('will-navigate', (event, address) => { if (address !== surface.url) event.preventDefault(); });
    view.webContents.on('will-attach-webview', event => event.preventDefault());
    view.on('move', () => { this.refreshRates(); this.scheduleSave(); }); view.on('resize', () => this.scheduleSave());
    view.on('show', () => { this.refreshRates(); this.sendFrame(surface); });
    view.on('hide', this.refreshRates);
    view.webContents.on('did-start-loading', () => { surface.frameInFlight = false; });
    view.on('closed', () => { this.surfaces.delete(senderId); if (!this.stopping) this.refreshRates(); if (surface.token) this.files.delete(surface.token); for (const token of surface.galleryTokens) this.files.delete(token); if (surface.remote && !surface.remote.isDestroyed()) surface.remote.destroy(); this.scheduleSave(); });
    view.once('ready-to-show', () => view.show());
    try { await view.loadURL(surface.url); return surface; } catch (error) { view.destroy(); throw error; }
  }

  private publish(surface: Surface): void {
    if (surface.view.isDestroyed()) return;
    if (surface.view.getTitle() !== surface.state.title) surface.view.setTitle(surface.state.title);
    surface.view.webContents.send('sao:surface:state', { ...surface.state });
  }
  private async navigate(surface: Surface, url: string): Promise<void> {
    if (!surface.remote) throw new Error('This preview is not a browser.');
    surface.state.error = ''; surface.state.url = url; this.publish(surface);
    try { await surface.remote.loadURL(url); }
    catch (error) {
      // Chromium aborts the superseded request on client-side redirects and
      // when the user stops or replaces navigation. The current page remains
      // authoritative; only actual failures should cover it with an error.
      const failure = error as NodeJS.ErrnoException;
      if (failure.errno !== -3 && failure.code !== 'ERR_ABORTED') throw error;
    }
  }
  private input(surface: Surface, raw: unknown): void {
    if (!surface.remote || !raw || typeof raw !== 'object') throw new Error('Invalid browser input.');
    const input = raw as SurfaceInput;
    if (!['mouseMove', 'mouseDown', 'mouseUp', 'mouseWheel', 'keyDown', 'keyUp', 'char'].includes(input.type)) throw new Error('Invalid browser input type.');
    const modifiers = Array.isArray(input.modifiers) ? input.modifiers.filter((value): value is 'shift' | 'control' | 'alt' | 'meta' => ['shift', 'control', 'alt', 'meta'].includes(value)).slice(0, 4) : undefined;
    if (input.type.startsWith('mouse')) {
      if (!Number.isFinite(input.x) || !Number.isFinite(input.y) || input.x! < 0 || input.x! >= contentWidth || input.y! < 0 || input.y! >= contentHeight) throw new Error('Invalid browser pointer.');
      if (input.type === 'mouseWheel') {
        if (!Number.isFinite(input.deltaX) || !Number.isFinite(input.deltaY) || Math.abs(input.deltaX!) > 10000 || Math.abs(input.deltaY!) > 10000) throw new Error('Invalid browser wheel.');
        surface.remote.webContents.sendInputEvent({ type: 'mouseWheel', x: Math.round(input.x!), y: Math.round(input.y!), deltaX: input.deltaX!, deltaY: input.deltaY!, modifiers });
      } else {
        const button = ['left', 'right', 'middle'].includes(input.button ?? '') ? input.button! : 'left';
        surface.remote.webContents.sendInputEvent({ type: input.type as 'mouseMove' | 'mouseDown' | 'mouseUp', x: Math.round(input.x!), y: Math.round(input.y!), button, clickCount: 1, modifiers });
      }
    } else {
      if (typeof input.keyCode !== 'string' || !input.keyCode.length || input.keyCode.length > 32) throw new Error('Invalid browser key.');
      surface.remote.webContents.sendInputEvent({ type: input.type as 'keyDown' | 'keyUp' | 'char', keyCode: input.keyCode, modifiers });
    }
  }
}
