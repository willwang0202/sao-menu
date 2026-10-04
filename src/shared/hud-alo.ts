import type { SystemStats } from './contracts';

/** Geometry of the original HP-Bar widget's ALO style (StyleALO.qml, BarItemALO.qml, BarALO.qml). */
export const ALO_BAR_WIDTH = 296, ALO_BAR_HEIGHT = 68;
export const ALO_HP_WIDTH = 256, ALO_MP_WIDTH = 210, ALO_CAP = 7;
const ALO_MAIN_GAP = 10, ALO_EXTRA_GAP = 1, ALO_MAX_COMPANIONS = 5;
const ALO_RED = .25, ALO_YELLOW = .5;

const companions = (count: number) => Math.max(0, Math.min(ALO_MAX_COMPANIONS, count));
export const aloExtraTop = (index: number) => ALO_BAR_HEIGHT + ALO_MAIN_GAP + index * (ALO_BAR_HEIGHT + ALO_EXTRA_GAP);
export const aloHeight = (count: number) => companions(count) > 0 ? aloExtraTop(companions(count)) - ALO_EXTRA_GAP : ALO_BAR_HEIGHT;
const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
/** Visible bar width before the mirrored end cap: the mask slides across width minus both caps. */
export const aloFillWidth = (progress: number, imageWidth: number) => Math.round((unit(progress) - 1) * (imageWidth - 2 * ALO_CAP)) + imageWidth - ALO_CAP;
export const aloHpImage = (progress: number) => `alo-hp-${progress <= ALO_RED ? 'red' : progress <= ALO_YELLOW ? 'yellow' : 'green'}.png`;
/** The ALO preset feeds MP from physical memory load; an unconfigured MP bar stays full. */
export function aloMana(stats: SystemStats | null): number {
  const used = stats?.memoryUsed, total = stats?.memoryTotal;
  return typeof used === 'number' && typeof total === 'number' && Number.isFinite(used) && total > 0 ? unit(used / total) : 1;
}
