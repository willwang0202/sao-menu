import { seededRandom } from './random';

/**
 * A field of rods lying along the view axis, passed by a camera at constant speed.
 * Projected, each rod is a wedge: wide and round near the camera, tapering toward the
 * vanishing point, with its head motion-blurred over one exposure.
 */
export type RodFieldConfig = Readonly<{
  seed: number;
  count: number;
  speed: number;
  focal: number;
  near: number;
  innerRadius: number;
  outerRadius: number;
  /** Window in which rods' far ends pass the camera; density ramps up through it. */
  passStart: number;
  passEnd: number;
  lengthMin: number;
  lengthMax: number;
  widthMin: number;
  widthMax: number;
  fogFar: number;
  fogNear: number;
  shutter: number;
  centerX: number;
  centerY: number;
  palette: readonly string[];
  /** No rod's near end passes before this time (the field arrives all at once). */
  firstNearPass?: number;
  /** Optional fixed near-end pass times for the first rods, with a short length. */
  early?: readonly number[];
  earlyLength?: number;
}>;

type Rod = Readonly<{ cos: number; sin: number; angle: number; radius: number; nearPass: number; length: number; width: number; color: string }>;

function createRods(config: RodFieldConfig): Rod[] {
  const random = seededRandom(config.seed);
  return Array.from({ length: config.count }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const radius = config.innerRadius + (config.outerRadius - config.innerRadius) * Math.sqrt(random());
    const early = config.early?.[index];
    // sqrt: density builds up through the pass, like the source's gradual fill.
    const farPass = config.passStart + (config.passEnd - config.passStart) * Math.sqrt(random());
    // Squared: mostly short dashes with a few long wedges.
    const length = early === undefined ? config.lengthMin + (config.lengthMax - config.lengthMin) * random() ** 2 : config.earlyLength ?? config.lengthMin;
    return {
      cos: Math.cos(angle), sin: Math.sin(angle), angle, radius, length,
      nearPass: early ?? Math.max(config.firstNearPass ?? -Infinity, farPass - length / config.speed),
      width: radius * (config.widthMin + (config.widthMax - config.widthMin) * random()),
      color: config.palette[Math.floor(random() * config.palette.length)],
    };
  });
}

function drawRod(ctx: CanvasRenderingContext2D, config: RodFieldConfig, rod: Rod, nearDepth: number) {
  const farDepth = nearDepth + rod.length;
  const near = Math.max(config.near, nearDepth);
  const project = (depth: number) => config.focal * rod.radius / depth;
  const nearRho = project(near), farRho = project(farDepth);
  const nearHalf = config.focal * rod.width / near, farHalf = config.focal * rod.width / farDepth;
  const { centerX: cx, centerY: cy } = config;
  const nx = cx + rod.cos * nearRho, ny = cy + rod.sin * nearRho;
  const fx = cx + rod.cos * farRho, fy = cy + rod.sin * farRho;
  // The head was this far inward when the exposure opened; it fades out beyond that.
  const blurRho = project(Math.min(farDepth, near + config.speed * config.shutter));
  const tipRho = nearRho + nearHalf;
  const gradient = ctx.createLinearGradient(fx, fy, cx + rod.cos * tipRho, cy + rod.sin * tipRho);
  const solidUntil = Math.max(0, Math.min(1, (blurRho - farRho) / Math.max(1e-6, tipRho - farRho)));
  gradient.addColorStop(0, rod.color);
  gradient.addColorStop(solidUntil, rod.color);
  gradient.addColorStop(1, rod.color + '00');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(nx, ny, nearHalf, rod.angle - Math.PI / 2, rod.angle + Math.PI / 2);
  ctx.arc(fx, fy, farHalf, rod.angle + Math.PI / 2, rod.angle + Math.PI * 1.5);
  ctx.closePath();
  ctx.fill();
}

export function createRodField(config: RodFieldConfig) {
  const rods = createRods(config);
  const fogSpan = config.fogFar - config.fogNear;
  return (ctx: CanvasRenderingContext2D, t: number) => {
    const base = ctx.globalAlpha;
    // Far rods first so nearer ones overlap them, as in a depth-sorted render.
    const visible = rods
      .map(rod => ({ rod, depth: config.speed * (rod.nearPass - t) }))
      .filter(({ rod, depth }) => depth + rod.length > config.near && depth < config.fogFar)
      .sort((a, b) => b.depth - a.depth);
    for (const { rod, depth } of visible) {
      ctx.globalAlpha = base * Math.min(1, (config.fogFar - depth) / fogSpan);
      drawRod(ctx, config, rod, depth);
    }
    ctx.globalAlpha = base;
  };
}
