import type { Point } from './landmarks';

/** One-Euro filter (Casiez et al., CHI 2012): low lag when fast, low jitter when slow. */
export interface OneEuroParams { minCutoff: number; beta: number; dCutoff: number }
export interface OneEuroState { readonly t: number; readonly value: Point; readonly velocity: Point }

const MS_PER_SECOND = 1000;

function smoothing(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

const blend = (from: Point, to: Point, alpha: number): Point => ({ x: from.x + (to.x - from.x) * alpha, y: from.y + (to.y - from.y) * alpha });

export function filterPoint(state: OneEuroState | null, point: Point, t: number, params: OneEuroParams): { state: OneEuroState; value: Point } {
  if (!state) {
    const initial = { t, value: { ...point }, velocity: { x: 0, y: 0 } };
    return { state: initial, value: initial.value };
  }
  const dt = (t - state.t) / MS_PER_SECOND;
  if (dt <= 0) return { state, value: state.value };
  const raw = { x: (point.x - state.value.x) / dt, y: (point.y - state.value.y) / dt };
  const velocity = blend(state.velocity, raw, smoothing(params.dCutoff, dt));
  const cutoff = params.minCutoff + params.beta * Math.hypot(velocity.x, velocity.y);
  const value = blend(state.value, point, smoothing(cutoff, dt));
  return { state: { t, value, velocity }, value };
}
