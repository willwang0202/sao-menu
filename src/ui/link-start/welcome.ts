import { progress } from './ease';
import { sampleTrack } from './keyframes';

/** "Welcome to Sword Art Online !" in the SAO UI face, widths matched to the reference. */
const FONT_SIZE = 155;
const LINES = [
  { text: 'Welcome to', baseline: 495, width: 804 },
  { text: 'Sword Art Online !', baseline: 690, width: 1340 },
] as const;
const CENTER_X = 960, ZOOM_ORIGIN_Y = 555;
const FADE_IN = [14.2, 14.6] as const;
const FADE_OUT = [16.27, 16.31] as const;
/** Slow drift while held, then the camera flies through the text (log-scale keys). */
const ZOOM = [[14.6, 1], [15.85, 1.045], [16.1, 1.2], [16.2, 1.4], [16.25, 1.72], [16.29, 2.6], [16.31, 3.4]]
  .map(([t, scale]) => ({ t, value: [Math.log(scale)] }));

const spacing = new Map<string, number>();
function letterSpacing(ctx: CanvasRenderingContext2D, line: (typeof LINES)[number]): number {
  const cached = spacing.get(line.text);
  if (cached !== undefined) return cached;
  ctx.letterSpacing = '0px';
  const natural = ctx.measureText(line.text).width;
  const value = (line.width - natural) / (line.text.length - 1);
  // Only cache once the web font is in use; the fallback face measures differently.
  if (document.fonts.check(`${FONT_SIZE}px "SAO UI"`)) spacing.set(line.text, value);
  return value;
}

export function drawWelcome(ctx: CanvasRenderingContext2D, t: number) {
  const alpha = progress(t, ...FADE_IN) * (1 - progress(t, ...FADE_OUT));
  if (alpha <= 0) return;
  const scale = Math.exp(sampleTrack(ZOOM, t)[0]);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(CENTER_X, ZOOM_ORIGIN_Y);
  ctx.scale(scale, scale);
  ctx.translate(-CENTER_X, -ZOOM_ORIGIN_Y);
  ctx.font = `${FONT_SIZE}px "SAO UI"`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#080808';
  for (const line of LINES) {
    ctx.letterSpacing = `${letterSpacing(ctx, line)}px`;
    ctx.fillText(line.text, CENTER_X - line.width / 2, line.baseline);
  }
  ctx.letterSpacing = '0px';
  ctx.restore();
}
