import { lerp } from './ease';

/**
 * One sensor-check dial. Geometry is in units of the dial radius R, measured from the
 * reference close-up where R = 1000px and the label box is 441px wide.
 */
type Palette = Readonly<{ dark: string; light: string; cyan: string; purple: string; sage: string; outer: string; box: string; okBox: string; text: string; stroke: string }>;

const BLUE: Palette = { dark: '#23ade0', light: '#66c4ef', cyan: '#4ddaef', purple: '#9c88df', sage: '#9ebda7', outer: '#22acdf', box: '#e6f1f5', okBox: '#a3e6d6', text: '#9ee2dc', stroke: '#e3cbff' };
const GREEN: Palette = { dark: '#1fd36a', light: '#83ef8e', cyan: '#6bec9f', purple: '#5fd67e', sage: '#8fd9a0', outer: '#1edc71', box: '#c9f7d4', okBox: '#5bee7b', text: '#5bd88a', stroke: '#d6ffe0' };

type ColorKey = 'dark' | 'light' | 'cyan' | 'purple' | 'sage' | 'outer';
/** [inner, outer, start°, end°, colour, spin°/s]; angles clockwise from +x. */
type Segment = readonly [number, number, number, number, ColorKey, number];

const FULL = 360;
const SEGMENTS: readonly Segment[] = [
  [0.258, 0.282, 0, FULL, 'light', 0],
  [0.282, 0.334, 0, FULL, 'dark', 0],
  [0.336, 0.418, 0, FULL, 'light', 0],
  [0.336, 0.4, -150, -50, 'purple', 18],
  [0.336, 0.418, 150, 200, 'purple', 18],
  [0.42, 0.526, 0, FULL, 'light', 0],
  [0.42, 0.506, -35, 40, 'sage', -12],
  [0.43, 0.5, 200, 235, 'purple', -12],
  [0.528, 0.55, -120, 110, 'purple', 10],
  [0.552, 0.576, -150, -40, 'purple', 10],
  [0.552, 0.576, 30, 160, 'purple', 10],
  [0.578, 0.588, 0, FULL, 'light', 0],
  [0.592, 0.628, 0, FULL, 'cyan', 0],
  [0.634, 0.786, 0, FULL, 'light', 0],
  [0.68, 0.79, -128, -88, 'purple', 6],
  [0.7, 0.786, 95, 120, 'purple', 6],
  [0.812, 0.832, -60, -25, 'purple', -8],
  [0.836, 0.874, -75, 70, 'sage', -8],
  [0.836, 0.874, 120, 170, 'sage', -8],
  [0.932, 0.972, -110, -15, 'outer', 14],
  [0.932, 0.972, 20, 95, 'outer', 14],
  [0.932, 0.972, 140, 250, 'outer', 14],
  [0.972, 1.036, -60, -38, 'outer', 14],
  [0.972, 1.03, 175, 190, 'outer', 14],
];
const DISC = 0.257;
const HEXAGON_RING = 0.7, HEXAGON_SIZE = 0.013, HEXAGON_STEP = 20, HEXAGON_PHASE = -106.5;
const LABEL_WIDTH = 0.441, LABEL_HEIGHT = 0.134, LABEL_FONT = 0.118;
const MARKER_X = -1.12, MARKER_SIZE = 0.07, MARKER_STEP = 0.21;
const STROKE = 0.003, MIN_STROKE_PX = 1.6;
/** Small dials read as lavender in the source: its edge glow dominates at a distance. */
const GLOW_COLOR = '226,170,240', GLOW_INNER = 0.55, GLOW_OUTER = 1.08, GLOW_MAX_ALPHA = 0.55, GLOW_FULL_RADIUS = 120, GLOW_NONE_RADIUS = 420;
const DEG = Math.PI / 180;

export type DialState = Readonly<{
  x: number; y: number; radius: number; alpha: number;
  label: string; ok: number; green: number; time: number; phase: number;
}>;

function mix(a: string, b: string, amount: number): string {
  if (amount <= 0) return a;
  if (amount >= 1) return b;
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const value = [0, 1, 2].map(i => Math.round(lerp(channel(a, i), channel(b, i), amount)));
  return `rgb(${value.join(',')})`;
}

function ringPath(ctx: CanvasRenderingContext2D, x: number, y: number, inner: number, outer: number, start: number, end: number) {
  ctx.beginPath();
  if (end - start >= FULL) {
    ctx.arc(x, y, outer, 0, Math.PI * 2);
    ctx.arc(x, y, inner, Math.PI * 2, 0, true);
  } else {
    ctx.arc(x, y, outer, start * DEG, end * DEG);
    ctx.arc(x, y, inner, end * DEG, start * DEG, true);
  }
  ctx.closePath();
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 + 30) * DEG;
    ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
  }
  ctx.closePath();
}

function drawLabel(ctx: CanvasRenderingContext2D, dial: DialState, palette: (key: keyof Palette) => string, pixel: number) {
  const { x, y, radius: r } = dial;
  const width = LABEL_WIDTH * r, height = LABEL_HEIGHT * r;
  ctx.fillStyle = mix(palette('box'), palette('okBox'), dial.ok);
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
  const fontSize = LABEL_FONT * r;
  if (fontSize * pixel < 2) return;
  ctx.font = `300 ${fontSize}px "Helvetica Neue", "Source Han Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // The name fades out of the white box, the box turns mint, then a white OK fades in.
  const nameAlpha = 1 - Math.min(1, dial.ok * 2), okAlpha = Math.max(0, dial.ok * 2 - 1);
  if (nameAlpha > 0) {
    ctx.globalAlpha = dial.alpha * nameAlpha;
    ctx.fillStyle = palette('text');
    ctx.fillText(dial.label, x, y + fontSize * 0.04);
  }
  if (okAlpha > 0) {
    ctx.globalAlpha = dial.alpha * okAlpha;
    ctx.fillStyle = '#ffffff';
    ctx.letterSpacing = `${fontSize * 0.12}px`;
    ctx.fillText('OK', x + fontSize * 0.06, y + fontSize * 0.04);
    ctx.letterSpacing = '0px';
  }
  ctx.globalAlpha = dial.alpha;
}

function drawGlow(ctx: CanvasRenderingContext2D, dial: DialState) {
  const strength = GLOW_MAX_ALPHA * Math.min(1, Math.max(0, (GLOW_NONE_RADIUS - dial.radius) / (GLOW_NONE_RADIUS - GLOW_FULL_RADIUS)));
  if (strength <= 0) return;
  const { x, y, radius: r } = dial;
  const color = dial.green > 0.5 ? '120,235,140' : GLOW_COLOR;
  const glow = ctx.createRadialGradient(x, y, GLOW_INNER * r, x, y, GLOW_OUTER * r);
  glow.addColorStop(0, `rgba(${color},0)`);
  glow.addColorStop(0.6, `rgba(${color},${strength})`);
  glow.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, GLOW_OUTER * r, 0, Math.PI * 2);
  ctx.fill();
}

/** pixel: device pixels per reference pixel, so hairlines stay visible when the dial is small. */
export function drawDial(ctx: CanvasRenderingContext2D, dial: DialState, pixel: number) {
  if (dial.alpha <= 0 || dial.radius <= 0) return;
  const { x, y, radius: r } = dial;
  const palette = (key: keyof Palette) => mix(BLUE[key], GREEN[key], dial.green);
  ctx.save();
  ctx.globalAlpha = dial.alpha;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = palette('stroke');
  ctx.lineWidth = Math.max(STROKE * r, MIN_STROKE_PX / pixel);

  drawGlow(ctx, dial);
  ctx.beginPath();
  ctx.arc(x, y, DISC * r, 0, Math.PI * 2);
  ctx.fillStyle = palette('dark');
  ctx.fill();
  for (const [inner, outer, start, end, color, spin] of SEGMENTS) {
    const turn = end - start >= FULL ? 0 : spin * dial.time + dial.phase;
    ringPath(ctx, x, y, inner * r, outer * r, start + turn, end + turn);
    ctx.fillStyle = palette(color);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = palette('dark');
  for (let angle = HEXAGON_PHASE; angle < HEXAGON_PHASE + FULL; angle += HEXAGON_STEP) {
    drawHexagon(ctx, x + Math.cos(angle * DEG) * HEXAGON_RING * r, y + Math.sin(angle * DEG) * HEXAGON_RING * r, HEXAGON_SIZE * r);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = palette('dark');
  for (let i = 0; i < 3; i++) {
    const size = MARKER_SIZE * r;
    ctx.fillRect(x + MARKER_X * r - size / 2, y - 2 * MARKER_STEP * r + i * MARKER_STEP * r - size / 2, size, size);
  }
  drawLabel(ctx, dial, palette, pixel);
  ctx.restore();
}
