import React, { useEffect, useRef, useState } from 'react';
import { browserPerspective, pagePoint, type BrowserFrame, type SurfaceInput, type SurfaceState } from '../shared/surfaces';
import { CurvedBrowser } from './browser-gl';
import './surface.css';
import { GallerySurface } from './gallery';

const SYSTEM = './sao-original/System/';
const api = window.saoSurface!;
const modifiers = (event: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }) => [event.shiftKey && 'shift', event.ctrlKey && 'control', event.altKey && 'alt', event.metaKey && 'meta'].filter((value): value is string => !!value);

export function SurfaceApp() {
  const [state, setState] = useState<SurfaceState | null>(null);
  const [error, setError] = useState('');
  const [pointer, setPointer] = useState({ x: innerWidth / 2, y: innerHeight / 2 });
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const detachState = api.onState(setState);
    let frame = 0;
    let pending = pointer;
    const detachPointer = api.onPointer(next => { pending = next; if (!frame) frame = requestAnimationFrame(() => { frame = 0; setPointer(pending); }); });
    void api.getState().then(setState).catch(error => setError(String(error)));
    return () => { cancelAnimationFrame(frame); detachState(); detachPointer(); };
  }, []);
  if (!state) return <div className="surface-loading" role="status">{error || 'Loading…'}</div>;
  const motion = !state.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const horizontal = Math.max(-1, Math.min(1, (pointer.x - innerWidth / 2) / innerWidth));
  const vertical = Math.max(-1, Math.min(1, (pointer.y - innerHeight / 2) / innerHeight));
  const perspective = state.kind !== 'gallery' ? browserPerspective(innerWidth-40,state.fieldOfView) : 1600;
  return <div className={`surface-scene ${state.reducedMotion ? 'reduce-motion' : ''} ${dragging ? 'file-drag' : ''}`} onDragOver={event => { if (state.kind !== 'browser' && event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'link'; setDragging(true); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); setError(''); void api.dropFiles([...event.dataTransfer.files]).catch(error => setError(String(error))); }}>
    <section className={`floating-surface ${state.kind === 'browser' ? 'browser-surface' : 'media-surface'}`} style={{ transform: motion ? `perspective(${perspective}px) rotateX(${-vertical * 6}deg) rotateY(${horizontal * 9}deg)` : undefined }} aria-label={state.kind === 'browser' ? 'Built-in web browser' : state.kind === 'video' ? 'Video preview' : state.kind === 'gallery' ? 'Gallery preview' : 'Image preview'}>
      {state.kind === 'browser' ? <BrowserSurface state={state} /> : state.kind === 'gallery' ? <GallerySurface state={state} /> : <MediaSurface state={state} />}
      {error && <div className="surface-error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
    </section>
    <PreviewCorner state={state} onError={setError} />
  </div>;
}

function OriginalControl({ icon, label, onClick, onHover }: { icon: string; label: string; onClick: () => void; onHover?: (hovered: boolean) => void }) {
  const [hovered, setHovered] = useState(false);
  const hover = (value: boolean) => { setHovered(value); onHover?.(value); };
  return <button className="surface-control" aria-label={label} title={label} onMouseEnter={() => hover(true)} onMouseLeave={() => hover(false)} onFocus={() => hover(true)} onBlur={() => hover(false)} onClick={onClick}><img src={`${SYSTEM}${icon}${hovered ? '-hovered' : ''}.png`} alt="" /></button>;
}

function BrowserSurface({ state }: { state: SurfaceState }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [address, setAddress] = useState(state.url || '');
  const [addressOpen, setAddressOpen] = useState(state.url === '' || state.url === 'about:blank');
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const redraw = useRef<() => void>(() => {});
  const chromeHover = useRef<'close' | 'reload' | null>(null);
  const hoverChrome = (control: 'close' | 'reload', hovered: boolean) => { chromeHover.current = hovered ? control : null; redraw.current(); };
  const inputQueue = useRef(Promise.resolve());
  const call = (command: 'back' | 'forward' | 'reload' | 'stop' | 'close' | 'external') => { setError(''); void api.command(command).catch(e => setError(String(e))); };
  useEffect(() => { setAddress(state.url === 'about:blank' ? '' : state.url); if (state.url && state.url !== 'about:blank') setAddressOpen(false); }, [state.url]);
  useEffect(() => {
    let active = true, pending: BrowserFrame | null = null, animation = 0, dirty = true, count = 0;
    const element = canvas.current!;
    let renderer: CurvedBrowser;
    try { renderer = new CurvedBrowser(element); } catch(error) { setError(String(error)); return; }
    const composed = document.createElement('canvas'); composed.width = 1000; composed.height = 700;
    const source = composed.getContext('2d')!;
    const chrome: Record<string, HTMLImageElement> = {};
    for (const name of ['web-frame', 'web-close', 'web-close-hovered', 'web-reload', 'web-reload-hovered', 'web-stop', 'web-stop-hovered']) {
      const image = new Image(); image.src = `${SYSTEM}${name}.png`; chrome[name] = image;
      image.onload = () => { if (active) dirty = true; };
    }
    const drawChrome = () => {
      source.clearRect(0, 0, 1000, 700); source.fillStyle = '#f7f7f7'; source.fillRect(0, 0, 1000, 38); source.fillRect(0, 678, 1000, 22);
      if (chrome['web-frame'].complete && chrome['web-frame'].naturalWidth) source.drawImage(chrome['web-frame'], 0, 0, 220, 56, 0, 0, 220, 38);
      source.font = '500 13px "Source Han Sans", sans-serif'; source.fillStyle = '#666'; source.textAlign = 'left';
      source.fillText(stateRef.current.title.slice(0, 60), 60, 25, 810);
      const close = chrome[chromeHover.current === 'close' ? 'web-close-hovered' : 'web-close']; if (close.complete && close.naturalWidth) source.drawImage(close, 975, 8, 14, 20);
      const reload = chrome[(stateRef.current.loading ? 'web-stop' : 'web-reload') + (chromeHover.current === 'reload' ? '-hovered' : '')];
      if (reload.complete && reload.naturalWidth) source.drawImage(reload, 6, 682, 14, 16);
      source.font = '12px "SAO UI", sans-serif'; source.fillStyle = '#999'; source.textAlign = 'right';
      source.fillText(stateRef.current.url === 'about:blank' ? 'Enter web address' : stateRef.current.url, 992, 695, 850);
      renderer.updateChrome(composed);
    };
    redraw.current = () => { dirty = true; };
    void document.fonts.ready.then(() => { if (active) dirty = true; });
    const detach = api.onFrame(next => { pending = next; });
    // Recover the cached frame if it arrived before this component subscribed.
    void api.getState(); api.acknowledgeFrame();
    const resize = new ResizeObserver(() => { dirty = true; }); resize.observe(element);
    const tick = () => {
      const next = pending; pending = null;
      try {
        if (next) renderer.updatePage(next);
        if (dirty) drawChrome();
        if (next || dirty) { renderer.draw(stateRef.current.fieldOfView); element.dataset.frames = String(++count); }
        dirty = false;
      } catch(error) { setError(String(error)); }
      finally { if (next) api.acknowledgeFrame(); }
      if (active) animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(animation); resize.disconnect(); detach(); renderer.dispose(); redraw.current = () => {}; };
  }, []);
  useEffect(() => { redraw.current(); }, [state.title, state.url, state.loading, state.fieldOfView]);
  const send = (input: SurfaceInput) => {
    inputQueue.current = inputQueue.current.catch(() => {}).then(() => api.input(input)).catch(e => setError(String(e)));
  };
  const point = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const element = event.currentTarget;
    const mapped = pagePoint(event.nativeEvent.offsetX * 1000 / element.clientWidth, event.nativeEvent.offsetY * 700 / element.clientHeight, 1000, 700, state.fieldOfView);
    return mapped && mapped.y >= 38 && mapped.y < 678 ? { x: mapped.x, y: mapped.y - 38 } : null;
  };
  const mouse = (event: React.MouseEvent<HTMLCanvasElement>, type: 'mouseMove' | 'mouseDown' | 'mouseUp') => {
    const position = point(event); if (!position) return;
    if (type === 'mouseDown') { event.currentTarget.focus(); setMenu(null); }
    send({ type, ...position, button: event.button === 2 ? 'right' : event.button === 1 ? 'middle' : 'left', modifiers: modifiers(event) });
  };
  const keyboard = (event: React.KeyboardEvent<HTMLCanvasElement>, type: 'keyDown' | 'keyUp') => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') { event.preventDefault(); setAddressOpen(true); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r') { event.preventDefault(); if (type === 'keyDown') call('reload'); return; }
    event.preventDefault();
    const key = event.key === ' ' ? 'Space' : event.key === 'ArrowLeft' ? 'Left' : event.key === 'ArrowRight' ? 'Right' : event.key === 'ArrowUp' ? 'Up' : event.key === 'ArrowDown' ? 'Down' : event.key;
    send({ type, keyCode: key.length === 1 ? key.toUpperCase() : key, modifiers: modifiers(event) });
    if (type === 'keyDown' && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) send({ type: 'char', keyCode: event.key, modifiers: modifiers(event) });
  };
  return <>
    <header className="browser-title surface-drag"><span>{state.title}</span><OriginalControl icon="web-close" label="Close browser" onHover={value => hoverChrome('close', value)} onClick={() => call('close')} /></header>
    <canvas className="curved-page" ref={canvas} width={2000} height={1400} tabIndex={0} aria-label="Web page" onMouseMove={e => mouse(e, 'mouseMove')} onMouseDown={e => mouse(e, 'mouseDown')} onMouseUp={e => mouse(e, 'mouseUp')} onKeyDown={e => keyboard(e, 'keyDown')} onKeyUp={e => keyboard(e, 'keyUp')} onWheel={e => { const position = point(e); if (position) send({ type: 'mouseWheel', ...position, deltaX: -e.deltaX, deltaY: -e.deltaY, modifiers: modifiers(e) }); }} onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }} />
    <footer className="browser-status"><OriginalControl icon={state.loading ? 'web-stop' : 'web-reload'} label={state.loading ? 'Stop loading' : 'Reload page'} onHover={value => hoverChrome('reload', value)} onClick={() => call(state.loading ? 'stop' : 'reload')} /><button className="browser-address-display" title="Open address · ⌘/Ctrl+L" onClick={() => setAddressOpen(true)}>{state.url === 'about:blank' ? 'Enter web address' : state.url}</button></footer>
    {(error || state.error) && <div className="surface-error" role="alert">{error || state.error}<button onClick={() => { setError(''); setAddressOpen(true); }}>Change address</button></div>}
    {addressOpen && <form className="browser-address-form" onSubmit={e => { e.preventDefault(); void api.navigate(address.trim()).then(() => { setError(''); setAddressOpen(false); canvas.current?.focus(); }).catch(e => setError(String(e))); }}><label>Web address<input aria-label="Web address" autoFocus placeholder="https://…" value={address} onChange={e => setAddress(e.target.value)} onFocus={e => e.target.select()} /></label><button type="submit">Open</button><button type="button" onClick={() => setAddressOpen(false)}>Cancel</button></form>}
    {menu && <div className="surface-context" role="menu" style={{ left: Math.min(menu.x, innerWidth - 190), top: Math.min(menu.y, innerHeight - 330) }}><button role="menuitem" disabled={!state.canGoBack} onClick={() => { call('back'); setMenu(null); }}>Back</button><button role="menuitem" disabled={!state.canGoForward} onClick={() => { call('forward'); setMenu(null); }}>Forward</button><button role="menuitem" onClick={() => { call('reload'); setMenu(null); }}>Reload</button><button role="menuitem" onClick={() => { setAddressOpen(true); setMenu(null); }}>Web address</button><button role="menuitem" onClick={() => { call('external'); setMenu(null); }}>Open in default browser</button>
      <label className="browser-fov">Field of view <output>{Math.round(state.fieldOfView)}°</output><input aria-label="Web preview field of view" type="range" min="20" max="100" step="1" value={state.fieldOfView} onChange={event => { void api.setFieldOfView(Number(event.target.value)).catch(e => setError(String(e))); }} /></label>
      <button role="menuitem" onClick={() => { void api.setFieldOfView(20).catch(e => setError(String(e))); }}>Reset field of view</button>
    </div>}
  </>;
}

function MediaSurface({ state }: { state: SurfaceState }) {
  const video = useRef<HTMLVideoElement>(null);
  const { fill, muted, autoResize } = state.presentation;
  const [playing, setPlaying] = useState(true);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState('');
  const dimensions = useRef({ width: 560, height: 370 });
  const resetSize = () => { void api.resize(dimensions.current.width + 40, dimensions.current.height + 40).catch(e => setError(String(e))); };
  const ready = (width: number, height: number) => { dimensions.current = { width, height }; if (autoResize && !state.restored) void api.resize(width + 40, height + 40).catch(e => setError(String(e))); };
  const presentation = (patch: Partial<SurfaceState['presentation']>) => { void api.setPresentation({ ...state.presentation, ...patch }).catch(error => setError(String(error))); };
  const toggle = () => { if (!video.current) return; if (video.current.paused) { void video.current.play().then(() => setPlaying(true)).catch(e => setError(String(e))); } else { video.current.pause(); setPlaying(false); } };
  useEffect(() => { setError(''); setPlaying(true); }, [state.url]);
  useEffect(() => {
    const exposed = () => { if (!video.current || !playing) return; if (document.hidden) video.current.pause(); else void video.current.play().catch(() => {}); };
    addEventListener('visibilitychange', exposed); return () => removeEventListener('visibilitychange', exposed);
  }, [playing]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (menu) setMenu(false); else void api.command('close'); } };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, [menu]);
  return <div className="media-content" onContextMenu={e => { e.preventDefault(); setMenu(!menu); }}>
    {state.kind === 'image' ? <img className="preview-image" src={state.url} alt={state.title} style={{ objectFit: fill }} onLoad={e => ready(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} onError={() => setError('This image could not be decoded.')} /> : <video ref={video} className="preview-video" src={state.url} autoPlay loop playsInline muted={muted} style={{ objectFit: fill }} aria-label={state.title} onLoadedMetadata={e => ready(e.currentTarget.videoWidth, e.currentTarget.videoHeight)} onClick={toggle} onError={() => setError('This video format is not supported by the browser engine.')} />}
    <header className="media-title surface-drag"><span>{state.title}</span><button className="surface-control media-external" aria-label="Open in default viewer" title="Open in default viewer" onClick={() => void api.command('external').catch(e => setError(String(e)))}><span className="original-fa">&#xf14c;</span></button></header>
    {state.kind === 'video' && <button className="media-play" aria-label={playing ? 'Pause video' : 'Play video'} onClick={toggle}>{playing ? 'Ⅱ' : '▷'}</button>}
    {error && <div className="surface-error" role="alert">{error}</div>}
    {menu && <div className="surface-context media-context" role="menu"><button role="menuitemcheckbox" aria-checked={autoResize} onClick={() => presentation({ autoResize: !autoResize })}>Auto Resize {autoResize ? '✓' : ''}</button>{state.kind === 'video' && <button role="menuitemcheckbox" aria-checked={muted} onClick={() => presentation({ muted: !muted })}>Mute {muted ? '✓' : ''}</button>}<button role="menuitemradio" aria-checked={fill === 'contain'} onClick={() => presentation({ fill: 'contain' })}>Fit {fill === 'contain' ? '✓' : ''}</button><button role="menuitemradio" aria-checked={fill === 'cover'} onClick={() => presentation({ fill: 'cover' })}>Crop {fill === 'cover' ? '✓' : ''}</button><button role="menuitem" onClick={() => { resetSize(); setMenu(false); }}>Reset Size</button><button role="menuitem" onClick={() => { setMenu(false); void api.command('change').catch(e => setError(String(e))); }}>{state.kind === 'image' ? 'Change Image' : 'Change Video'}</button><button role="menuitem" onClick={() => void api.command('close')}>Close</button></div>}
  </div>;
}


function PreviewCorner({ state, onError }: { state: SurfaceState; onError: (error: string) => void }) {
  const drag = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const frame = useRef(0);
  const pending = useRef<{ width: number; height: number } | null>(null);
  const resize = () => {
    frame.current = 0; const size = pending.current; pending.current = null;
    if (size) void api.resize(size.width, size.height).catch(error => onError(String(error)));
  };
  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);
  return <div className="surface-corner-tools">
    {state.kind !== 'gallery' && <label className="corner-fov"><span>FOV</span><input aria-label="Preview field of view" type="range" min="20" max="100" step="1" value={state.fieldOfView} onChange={event => void api.setFieldOfView(Number(event.target.value)).catch(error => onError(String(error)))} /><output>{Math.round(state.fieldOfView)}°</output></label>}
    <button className="surface-resize-handle" aria-label="Resize preview" title="Drag to resize; arrow keys adjust size" onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: event.screenX, y: event.screenY, width: innerWidth, height: innerHeight };
    }} onPointerMove={event => {
      if (!drag.current) return;
      pending.current = { width: drag.current.width + event.screenX - drag.current.x, height: drag.current.height + event.screenY - drag.current.y };
      if (!frame.current) frame.current = requestAnimationFrame(resize);
    }} onPointerUp={event => {
      drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (frame.current) cancelAnimationFrame(frame.current); resize();
    }} onPointerCancel={() => { drag.current = null; pending.current = null; if (frame.current) cancelAnimationFrame(frame.current); frame.current = 0; }} onKeyDown={event => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault(); void api.resize(innerWidth + (event.key === 'ArrowRight' ? 32 : event.key === 'ArrowLeft' ? -32 : 0), innerHeight + (event.key === 'ArrowDown' ? 32 : event.key === 'ArrowUp' ? -32 : 0)).catch(error => onError(String(error)));
    }}>◢</button>
  </div>;
}
