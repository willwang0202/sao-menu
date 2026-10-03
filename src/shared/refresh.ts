/** Unknown/variable native reports fall back to 60; Chromium RAF still uses vsync. */
export function displayFrameRate(frequency: number | null | undefined): number {
  return typeof frequency === 'number' && Number.isFinite(frequency) && frequency > 0 ? Math.max(1, Math.min(240, Math.round(frequency))) : 60;
}
export function pointerInterval(frequency: number | null | undefined): number { return Math.max(1, Math.floor(1000 / displayFrameRate(frequency))); }
