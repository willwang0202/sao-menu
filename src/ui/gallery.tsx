import React, { useEffect, useRef, useState } from 'react';
import type { GallerySettings, SurfaceState } from '../shared/surfaces';
import { galleryFrames, galleryTransitions } from '../shared/surface-layout';
import { GalleryRenderer, transitionName } from './gallery-gl';

const api = window.saoSurface!;
export function GallerySurface({ state }: { state: SurfaceState }) {
  const data = state.gallery;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(true);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const action = useRef<{ toggle(): void; roll(step: number): void }>({ toggle() {}, roll() {} });
  const index = useRef(0);
  const settingsRef = useRef(data?.settings); settingsRef.current = data?.settings;
  const reduced = useRef(state.reducedMotion); reduced.current = state.reducedMotion;
  useEffect(() => {
    if (!data || !canvas.current || !data.images.length) return;
    let active = true, generation = 0, animation = 0, progress = 0, elapsed = 0, last = performance.now(), phase: 'loading' | 'animate' | 'still' = 'loading';
    let current: HTMLImageElement | null = null;
    const images = [...data.images];
    if (data.settings.shuffle) for (let i = images.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [images[i], images[j]] = [images[j], images[i]]; }
    index.current %= images.length; setError('');
    let renderer: GalleryRenderer;
    try { renderer = new GalleryRenderer(canvas.current); } catch (error) { setError(String(error)); return; }
    const advance = async (step: number) => {
      const version = ++generation; phase = 'loading';
      index.current = (index.current + step + images.length) % images.length;
      const entry = images[index.current];
      const image = new Image(); image.crossOrigin = 'anonymous'; image.src = entry.url;
      try {
        await image.decode();
        if (!active || version !== generation) return;
        await renderer.shader(transitionName(settingsRef.current!), settingsRef.current!.fill === 'contain');
        if (!active || version !== generation) return;
        renderer.images(current, image); current = image;
        progress = 0; elapsed = 0; phase = 'animate'; last = performance.now();
        canvas.current!.dataset.image = entry.title; renderer.draw(0);
      } catch (error) { if (active && version === generation) setError(String(error)); }
    };
    const finish = () => { progress = 1; phase = 'still'; elapsed = 0; renderer.draw(1); };
    action.current = {
      toggle() { playingRef.current = !playingRef.current; setPlaying(playingRef.current); if (playingRef.current) void advance(1); else if (phase !== 'loading') finish(); },
      roll(step) { if (images.length > 1) void advance(step); },
    };
    const tick = (now: number) => {
      const delta = now - last; last = now;
      if (!document.hidden) {
        elapsed += delta;
        if (phase === 'animate') {
          const duration = reduced.current ? 0 : settingsRef.current!.animateTime;
          progress = duration ? Math.min(1, elapsed / duration) : 1; renderer.draw(progress);
          if (progress >= 1) { phase = 'still'; elapsed = 0; }
        } else if (phase === 'still' && playingRef.current && images.length > 1 && elapsed >= settingsRef.current!.stillTime) void advance(1);
      }
      animation = requestAnimationFrame(tick);
    };
    const resize = new ResizeObserver(() => renderer.draw(progress)); resize.observe(canvas.current);
    const lost = (event: Event) => { event.preventDefault(); setError('The gallery graphics context was lost. Refresh Gallery to restart it.'); };
    canvas.current.addEventListener('webglcontextlost', lost);
    void advance(0); animation = requestAnimationFrame(tick);
    return () => { active = false; generation++; cancelAnimationFrame(animation); resize.disconnect(); canvas.current?.removeEventListener('webglcontextlost', lost); renderer.destroy(); };
  }, [data?.revision, data?.settings.shuffle]);
  useEffect(() => {
    if (!data) return;
    // Original settings edits restart the animation; advancing by zero keeps
    // the chosen image while applying the new transition and sampling mode.
    action.current.roll(0);
  }, [data?.settings.transition, data?.settings.fill]);
  const command = (command: 'change' | 'refresh' | 'close') => { setMenu(false); void api.command(command).catch(error => setError(String(error))); };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (editing) setEditing(false); else if (menu) setMenu(false); else command('close'); } };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, [editing, menu]);
  if (!data) return <div className="surface-loading" role="status">Loading gallery…</div>;
  return <div className="gallery-content" style={{ backgroundColor: data.settings.fillColor }} onContextMenu={event => { event.preventDefault(); setMenu(!menu); }}>
    <canvas className="gallery-canvas" ref={canvas} aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} data-playing={playing} onClick={() => action.current.toggle()} onWheel={event => { action.current.roll(event.deltaY > 0 ? 1 : -1); }} />
    {data.settings.frame && <OriginalFrame name={data.settings.frame} above={data.settings.frameAbove} />}
    {!data.images.length && <div className="gallery-empty"><img src="./sao-original/Media/gallery-widget.png" alt="" /><span>No JPG, JPEG, PNG or WebP images in this folder.</span><button onClick={() => command('change')}>Image Folder</button></div>}
    <header className="media-title surface-drag"><span>Gallery Widget</span><span>{playing ? '▷' : 'Ⅱ'}</span></header>
    {error && <div className="surface-error" role="alert">{error}</div>}
    {menu && <div className="surface-context media-context" role="menu"><button role="menuitem" onClick={() => { setMenu(false); setEditing(true); }}>Settings…</button><button role="menuitem" onClick={() => command('refresh')}>Refresh Gallery</button><button role="menuitem" onClick={() => command('close')}>Close</button></div>}
    {editing && <GallerySettingsForm value={data.settings} onClose={() => setEditing(false)} onFolder={() => command('change')} onChange={settings => void api.setGallery(settings).catch(error => setError(String(error)))} />}
  </div>;
}

function GallerySettingsForm({ value, onChange, onClose, onFolder }: { value: GallerySettings; onChange(value: GallerySettings): void; onClose(): void; onFolder(): void }) {
  const change = (patch: Partial<GallerySettings>) => onChange({ ...value, ...patch });
  return <section className="gallery-settings" role="dialog" aria-label="Gallery Settings" onClick={event => event.stopPropagation()}><header><strong>Gallery Settings</strong><button onClick={onClose} aria-label="Close gallery settings">×</button></header>
    <label>Image Folder<button onClick={onFolder}>Choose…</button></label>
    <label>Fill Mode<select value={value.fill} onChange={event => change({ fill: event.target.value as GallerySettings['fill'] })}><option value="cover">Crop</option><option value="contain">Fit</option></select></label>
    <label>Background Color<input aria-label="Background Color" value={value.fillColor} onChange={event => change({ fillColor: event.target.value })} /></label>
    <label>Frame<select value={value.frame} onChange={event => change({ frame: event.target.value })}><option value="">None</option>{galleryFrames.map(frame => <option key={frame}>{frame}</option>)}</select></label>
    <label>Frame Above Image<input type="checkbox" checked={value.frameAbove} onChange={event => change({ frameAbove: event.target.checked })} /></label>
    <label>Shuffle Playback<input type="checkbox" checked={value.shuffle} onChange={event => change({ shuffle: event.target.checked })} /></label>
    <label>Transition Animation<select value={value.transition} onChange={event => change({ transition: event.target.value })}><option value="random">Random</option>{galleryTransitions.map(transition => <option key={transition} value={transition}>{transition.replace('.glsl', '')}</option>)}</select></label>
    <label>Animation Speed<select value={value.animateTime} onChange={event => change({ animateTime: Number(event.target.value) })}><option value={500}>Fast</option><option value={1000}>Normal</option><option value={2000}>Slow</option></select></label>
    <label>Change Image Every<select value={value.stillTime} onChange={event => change({ stillTime: Number(event.target.value) })}>{[1000, 5000, 15000, 30000, 60000, 300000, 900000, 1800000, 3600000].map(time => <option key={time} value={time}>{time < 60000 ? `${time / 1000} Seconds` : time < 3600000 ? `${time / 60000} Minutes` : '1 Hour'}</option>)}</select></label>
    <p>Click to toggle slideshow. Scroll to change image.</p>
  </section>;
}

function OriginalFrame({ name, above }: { name: string; above: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = new Image(); image.src = `./sao-original/Media/frame/${name}`;
    let active = true;
    const paint = () => {
      const target = canvas.current; if (!active || !target || !image.naturalWidth) return;
      const source = document.createElement('canvas'); source.width = image.naturalWidth; source.height = image.naturalHeight;
      const read = source.getContext('2d')!; read.drawImage(image, 0, 0);
      const width = source.width, height = source.height;
      target.width = Math.round(target.clientWidth * devicePixelRatio); target.height = Math.round(target.clientHeight * devicePixelRatio);
      const context = target.getContext('2d')!; context.clearRect(0, 0, target.width, target.height);
      if (!name.endsWith('.9.png')) { context.drawImage(image, 0, 0, target.width, target.height); return; }
      const stretch = (horizontal: boolean) => {
        const extent = horizontal ? width : height; let first = -1, last = -1;
        for (let i = 1; i < extent - 1; i++) { const pixel = read.getImageData(horizontal ? i : 0, horizontal ? 0 : i, 1, 1).data; if (pixel[3] > 200 && pixel[0] < 10 && pixel[1] < 10 && pixel[2] < 10) { if (first < 0) first = i; last = i; } }
        return first < 0 ? [1, extent - 1] : [first, last + 1];
      };
      const xs = stretch(true), ys = stretch(false);
      const sx = [1, xs[0], xs[1], width - 1], sy = [1, ys[0], ys[1], height - 1];
      const dx = [0, (xs[0] - 1) * devicePixelRatio, target.width - (width - 1 - xs[1]) * devicePixelRatio, target.width];
      const dy = [0, (ys[0] - 1) * devicePixelRatio, target.height - (height - 1 - ys[1]) * devicePixelRatio, target.height];
      for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) if (sx[x + 1] > sx[x] && sy[y + 1] > sy[y]) context.drawImage(image, sx[x], sy[y], sx[x + 1] - sx[x], sy[y + 1] - sy[y], dx[x], dy[y], dx[x + 1] - dx[x], dy[y + 1] - dy[y]);
    };
    image.onload = paint; const resize = new ResizeObserver(paint); if (canvas.current) resize.observe(canvas.current);
    return () => { active = false; resize.disconnect(); };
  }, [name]);
  return <canvas className={`gallery-frame ${above ? 'above' : 'below'}`} ref={canvas} aria-hidden="true" />;
}
