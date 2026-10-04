import { browserURL, mediaKind, normalizeFieldOfView, type GallerySettings, type MediaPresentation, type SurfaceKind } from './surfaces';

export const galleryTransitions = ['CircleCrop', 'Crosshatch', 'Cube', 'Directional', 'Fade', 'FadeColor', 'GridFlip', 'Hexagonalize', 'InvertedPageCurl', 'LinearBlur', 'LuminanceMelt', 'Pixelize', 'PolkaDotsCurtain', 'Radial', 'RandomSquares', 'SimpleZoom', 'SquaresWire', 'WindowSlice'].map(name => `${name}.glsl`);
export const galleryFrames = ['classic-white.9.png', 'compact-black.9.png', 'compact-white.9.png', 'drop-l-cyan.9.png', 'drop-l-grey.9.png', 'drop-l-pink.9.png', 'drop-m-cyan.9.png', 'drop-m-grey.9.png', 'drop-m-pink.9.png', 'full-black.9.png', 'instant-film.9.png', 'shadow-high.9.png', 'shadow-low.9.png', 'small-black.9.png', 'small-white.9.png', ...['dark', 'light'].flatMap(tone => [20, 40, 60].map(level => `scrim-${tone}-${level}.png`))];
export const defaultPresentation: MediaPresentation = { fill: 'contain', muted: false, autoResize: true };
export interface SurfaceLayout { kind: SurfaceKind; source: string; bounds: { x: number; y: number; width: number; height: number }; presentation: MediaPresentation; fieldOfView?: number; gallery?: GallerySettings }
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function normalizePresentation(value: unknown): MediaPresentation {
  const data = record(value);
  return { fill: data.fill === 'cover' ? 'cover' : 'contain', muted: data.muted === true, autoResize: data.autoResize !== false };
}
export function normalizeGallery(value: unknown): GallerySettings {
  const data = record(value);
  return { fill: data.fill === 'contain' ? 'contain' : 'cover',
    fillColor: typeof data.fillColor === 'string' && /^(?:transparent|#[a-fA-F0-9]{6}|#[a-fA-F0-9]{8})$/.test(data.fillColor) ? data.fillColor : 'transparent',
    frame: typeof data.frame === 'string' && galleryFrames.includes(data.frame) ? data.frame : '', frameAbove: data.frameAbove !== false,
    shuffle: data.shuffle === true, transition: typeof data.transition === 'string' && galleryTransitions.includes(data.transition) ? data.transition : 'random',
    animateTime: [500, 1000, 2000].includes(Number(data.animateTime)) ? Number(data.animateTime) : 1000,
    stillTime: [1000, 5000, 15000, 30000, 60000, 300000, 900000, 1800000, 3600000].includes(Number(data.stillTime)) ? Number(data.stillTime) : 5000 };
}
export function normalizeLayouts(value: unknown): SurfaceLayout[] {
  if (!Array.isArray(value)) return [];
  const result: SurfaceLayout[] = [];
  for (const raw of value.slice(0, 100)) {
    const data = record(raw); const bounds = record(data.bounds);
    const kind = data.kind as SurfaceKind;
    if (!['browser', 'image', 'video', 'gallery'].includes(kind) || typeof data.source !== 'string' || data.source.length > 8192 || /[\u0000-\u001f]/.test(data.source)) continue;
    let source = data.source;
    if (kind === 'browser') { try { source = browserURL(source); } catch { continue; } }
    else {
      if (!source.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(source)) continue;
      if (kind !== 'gallery' && mediaKind(source) !== kind) continue;
    }
    if (!['x', 'y', 'width', 'height'].every(key => typeof bounds[key] === 'number' && Number.isFinite(bounds[key]) && Math.abs(bounds[key] as number) <= 100000)) continue;
    if (Number(bounds.width) < 180 || Number(bounds.height) < 120) continue;
    result.push({ kind, source, bounds: { x: Math.round(Number(bounds.x)), y: Math.round(Number(bounds.y)), width: Math.round(Number(bounds.width)), height: Math.round(Number(bounds.height)) }, presentation: normalizePresentation(data.presentation), ...(kind !== 'gallery' ? { fieldOfView: normalizeFieldOfView(data.fieldOfView) } : {}), ...(kind === 'gallery' ? { gallery: normalizeGallery(data.gallery) } : {}) });
    if (result.length === 12) break;
  }
  return result;
}

export function initialPreviewSize(kind: SurfaceKind, area: { width: number; height: number }): { width: number; height: number } {
  return kind === 'browser' || kind === 'video'
    ? { width: Math.round(area.width * .9), height: Math.round(area.height * .9) }
    : { width: Math.min(560, area.width), height: Math.min(370, area.height) };
}
