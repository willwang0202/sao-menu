export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
/** Normalized position of t inside [start, end], clamped. */
export const progress = (t: number, start: number, end: number) => clamp01((t - start) / (end - start));
export const easeInQuad = (x: number) => x * x;
