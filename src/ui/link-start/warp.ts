import { clamp01, progress } from './ease';
import { sampleTrack } from './keyframes';
import { seededRandom } from './random';
import { createRodField } from './rods';
import { STARTUP } from './timeline';

/** The blue dive after "Welcome": a spark, blue rods rushing past, rays, then white. */
const CX = 960, CY = 545;
const SOURCE_FPS = 24;
const TAU = Math.PI * 2;
const BOKEH_SIZE = 0.24;
/** Additive rays are the costliest layer at Retina resolution; this count keeps 120Hz. */
const RAY_COUNT = 44;

const drawBlueRods = createRodField({
  seed: 2022, count: 320, speed: 131, focal: 960, near: 0.35, innerRadius: 1, outerRadius: 5,
  passStart: 16.62, passEnd: 19.4, firstNearPass: 16.6, lengthMin: 6, lengthMax: 120, widthMin: 0.05, widthMax: 0.15,
  fogFar: 150, fogNear: 100, shutter: 1 / 40, centerX: CX, centerY: CY,
  palette: ['#0b26c8', '#1433d8', '#1d4fe0', '#1f6ff0', '#2a95f2', '#38c8f0', '#5fe0f7'],
});

const BLUE_BACKGROUND = [16.9, 17.5] as const;
const RAYS = [16.95, 17.4] as const;
const LIGHTNING = [16.5, 18.3] as const;
const BOKEH = [16.7, 18.5] as const;
const WHITE = [17.9, STARTUP.whiteEnd] as const;
/** Radius of the white core, read from the reference. */
const GLOW = [[16.1, 20], [16.4, 45], [16.8, 260], [17.0, 340], [17.6, 520], [18.2, 700], [18.6, 1400]].map(([t, r]) => ({ t, value: [r] }));

const raySeeds = (() => {
  const random = seededRandom(77);
  return Array.from({ length: RAY_COUNT }, () => ({ angle: random() * TAU, width: 0.013 + random() * 0.045, phase: random() }));
})();

/** Per-source-frame flicker, so rays and bolts change at the film's 24fps beat. */
const flicker = (seed: number, t: number) => seededRandom(seed * 7919 + Math.floor(t * SOURCE_FPS))();

function drawSpark(ctx: CanvasRenderingContext2D, t: number) {
  const grow = progress(t, 16.08, 16.7);
  if (grow <= 0) return;
  const random = seededRandom(5 + Math.floor(t * SOURCE_FPS));
  const size = 60 + 480 * grow;
  const colors = ['#0d2cc8', '#1a3fd8', '#1f6ff0', '#4fd6f5'];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * TAU + random() * 0.3 + t * 0.6;
    const length = size * (0.3 + random() * random() * 1.4), half = 0.05 + random() * 0.07;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(angle - half) * size * 0.08, CY + Math.sin(angle - half) * size * 0.08);
    ctx.lineTo(CX + Math.cos(angle) * length, CY + Math.sin(angle) * length);
    ctx.lineTo(CX + Math.cos(angle + half) * size * 0.08, CY + Math.sin(angle + half) * size * 0.08);
    ctx.closePath();
    // Spikes fade toward their tips; a canvas blur filter here costs the warp its refresh rate.
    const color = colors[i % colors.length];
    const fade = ctx.createLinearGradient(CX, CY, CX + Math.cos(angle) * length, CY + Math.sin(angle) * length);
    fade.addColorStop(0, color);
    fade.addColorStop(1, color + '00');
    ctx.fillStyle = fade;
    ctx.fill();
  }
}

function drawRays(ctx: CanvasRenderingContext2D, t: number) {
  const strength = progress(t, ...RAYS);
  if (strength <= 0) return;
  const reach = 1400;
  ctx.globalCompositeOperation = 'lighter';
  raySeeds.forEach((ray, index) => {
    const alpha = strength * (0.18 + 0.32 * flicker(index, t + ray.phase));
    const angle = ray.angle + t * 0.05;
    ctx.fillStyle = `rgba(70,215,255,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(CX + Math.cos(angle - ray.width) * reach, CY + Math.sin(angle - ray.width) * reach);
    ctx.lineTo(CX + Math.cos(angle + ray.width) * reach, CY + Math.sin(angle + ray.width) * reach);
    ctx.closePath();
    ctx.fill();
  });
  ctx.globalCompositeOperation = 'source-over';
}

function drawLightning(ctx: CanvasRenderingContext2D, t: number) {
  if (t < LIGHTNING[0] || t > LIGHTNING[1]) return;
  const random = seededRandom(31 + Math.floor(t * SOURCE_FPS / 2));
  ctx.lineJoin = 'round';
  for (let bolt = 0; bolt < 3; bolt++) {
    const angle = random() * TAU;
    let x = CX + Math.cos(angle) * (120 + random() * 200), y = CY + Math.sin(angle) * (120 + random() * 200);
    const points: [number, number][] = [[x, y]];
    for (let i = 0; i < 9; i++) {
      x += Math.cos(angle) * 28 + (random() - 0.5) * 50;
      y += Math.sin(angle) * 28 + (random() - 0.5) * 50;
      points.push([x, y]);
    }
    for (const [width, color] of [[7, 'rgba(90,220,255,0.35)'], [2, 'rgba(240,252,255,0.95)']] as const) {
      ctx.beginPath();
      points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  }
}

function drawBokeh(ctx: CanvasRenderingContext2D, t: number) {
  const visible = progress(t, BOKEH[0], BOKEH[0] + 0.2) * (1 - progress(t, BOKEH[1] - 0.3, BOKEH[1]));
  if (visible <= 0) return;
  const random = seededRandom(404);
  for (let i = 0; i < 28; i++) {
    const angle = random() * TAU, radius = 1 + random() * 3, pass = 16.8 + random() * 1.8;
    const depth = 131 * (pass - t);
    if (depth < 2 || depth > 120) continue;
    const rho = 960 * radius / depth, size = 960 * BOKEH_SIZE / depth;
    ctx.globalAlpha = visible * clamp01((120 - depth) / 40) * 0.55;
    ctx.fillStyle = '#b9f5ff';
    ctx.beginPath();
    for (let k = 0; k < 6; k++) ctx.lineTo(CX + Math.cos(angle) * rho + Math.cos(k * TAU / 6) * size, CY + Math.sin(angle) * rho + Math.sin(k * TAU / 6) * size);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGlow(ctx: CanvasRenderingContext2D, t: number) {
  const radius = sampleTrack(GLOW, t)[0];
  const glow = ctx.createRadialGradient(CX, CY, 0, CX, CY, radius);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.25, 'rgba(235,252,255,0.9)');
  glow.addColorStop(0.6, 'rgba(120,225,255,0.35)');
  glow.addColorStop(1, 'rgba(80,200,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(CX - radius, CY - radius, radius * 2, radius * 2);
}

/** Drawn beneath the welcome text; the text flies away over the opening spark. */
export function drawWarp(ctx: CanvasRenderingContext2D, t: number) {
  const blue = progress(t, ...BLUE_BACKGROUND);
  if (blue > 0) {
    const background = ctx.createRadialGradient(CX, CY, 0, CX, CY, 1100);
    background.addColorStop(0, '#3ec4f4');
    background.addColorStop(0.5, '#2477ec');
    background.addColorStop(1, '#1435d0');
    ctx.globalAlpha = blue;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.globalAlpha = 1;
  }
  drawBlueRods(ctx, t);
  drawRays(ctx, t);
  drawSpark(ctx, t);
  drawBokeh(ctx, t);
  drawLightning(ctx, t);
  drawGlow(ctx, t);
}

/** White-out that ends the sequence, applied over everything in screen space. */
export const whiteOverlay = (t: number) => progress(t, ...WHITE) ** 1.3;
