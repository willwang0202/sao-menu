import { lerp, progress } from './ease';
import { STARTUP } from './timeline';

const DARK = 31;
const LIGHT = 236;
const GRAY = 127;
const GRAY_FADE_SECONDS = 0.17;
/** Measured corner falloff: flat inside the inscribed ellipse, about 15% darker at the corners. */
const VIGNETTE_ALPHA = 0.15;
const VIGNETTE_START = 0.686;
const VIGNETTE_RESOLUTION = 256;

export function backgroundLevel(t: number): number {
  if (t < STARTUP.grayStart) return LIGHT;
  return Math.round(lerp(LIGHT, GRAY, progress(t, STARTUP.grayStart, STARTUP.grayStart + GRAY_FADE_SECONDS)));
}

/** Opacity of the black opening that cuts to the light room. */
export const darkOverlay = (t: number) => 1 - progress(t, STARTUP.darkEnd, STARTUP.lightIn);
export const DARK_COLOR = `rgb(${DARK},${DARK},${DARK})`;

let vignette: HTMLCanvasElement | null = null;
/** Elliptical vignette, rendered once at low resolution and stretched to the display. */
export function vignetteImage(): HTMLCanvasElement {
  if (vignette) return vignette;
  const canvas = document.createElement('canvas');
  canvas.width = VIGNETTE_RESOLUTION; canvas.height = VIGNETTE_RESOLUTION;
  const ctx = canvas.getContext('2d')!;
  const half = VIGNETTE_RESOLUTION / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half * Math.SQRT2);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(VIGNETTE_START, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${VIGNETTE_ALPHA})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIGNETTE_RESOLUTION, VIGNETTE_RESOLUTION);
  vignette = canvas;
  return canvas;
}
