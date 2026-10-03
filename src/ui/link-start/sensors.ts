import { drawDial, type DialState } from './dial';
import { clamp01, easeInQuad, progress } from './ease';
import { sampleTrack, type Key } from './keyframes';

/**
 * Sensor checks (Touch, sight, Hearing, Taste, Smell). Each dial's screen position and
 * radius were read from the reference at 12–24fps: it approaches small, fills the view,
 * its label turns to OK, then it shrinks into a column on the right. The column turns
 * green and the dials scatter off-screen.
 */
type Point = readonly [number, number];
const DOCKS: readonly Point[] = [[1765, 120], [1757, 330], [1750, 537], [1745, 760], [1740, 963]];
const DOCK_RADIUS = 136;
const FADE_IN = 0.06;
const GREEN_START = 8.27, GREEN_END = 8.33;
const SCATTER_START = 8.583;
/** x positions while scattering: odd docks dash left, even docks slip right. */
const SCATTER_LEFT: readonly Key[] = [
  { t: 8.583, value: [0] }, { t: 8.625, value: [-115] }, { t: 8.667, value: [-295] },
  { t: 8.708, value: [-605] }, { t: 8.75, value: [-1040] }, { t: 8.79, value: [-1565] }, { t: 8.833, value: [-2100] },
];
const SCATTER_RIGHT: readonly Key[] = [
  { t: 8.583, value: [0] }, { t: 8.625, value: [34] }, { t: 8.667, value: [70] }, { t: 8.708, value: [123] }, { t: 8.75, value: [330] },
];

type Sense = Readonly<{
  label: string;
  /** [t, x, y, radius] keys up to the moment the dial docks. */
  keys: readonly (readonly [number, number, number, number])[];
  okAt: number;
  leaveAt: number;
  phase: number;
}>;

const SENSES: readonly Sense[] = [
  { label: 'Touch', okAt: 6.04, leaveAt: 6.333, phase: 0, keys: [
    [5.27, 930, 546, 30], [5.333, 930, 546, 45], [5.5, 924, 549, 60], [5.583, 909, 555, 75], [5.667, 885, 564, 127],
    [5.708, 825, 576, 215], [5.75, 360, 744, 1000], [6.333, 360, 744, 1000], [6.417, 495, 675, 920], [6.5, 840, 525, 690],
    [6.583, 1251, 339, 470], [6.667, 1596, 195, 245], [6.75, ...DOCKS[0], DOCK_RADIUS]] },
  { label: 'sight', okAt: 6.375, leaveAt: 6.417, phase: 40, keys: [
    [5.3, 1005, 525, 24], [5.333, 1005, 525, 36], [5.5, 1005, 531, 45], [5.583, 1005, 525, 50], [5.667, 1011, 525, 60],
    [5.833, 1020, 510, 70], [5.917, 1110, 480, 120], [6.0, 1560, 456, 1000], [6.417, 1566, 456, 1000], [6.5, 1590, 450, 900],
    [6.667, 1595, 440, 860], [6.75, 1626, 414, 710], [6.833, 1680, 378, 420], [6.917, 1725, 345, 210], [7.0, ...DOCKS[1], DOCK_RADIUS]] },
  { label: 'Hearing', okAt: 7.33, leaveAt: 7.5, phase: 85, keys: [
    [6.7, 909, 549, 30], [6.75, 909, 549, 45], [6.833, 894, 558, 65], [6.917, 846, 576, 112], [6.958, 759, 609, 213],
    [7.0, 204, 801, 1000], [7.5, 240, 801, 1000], [7.54, 360, 780, 920], [7.583, 531, 750, 820], [7.625, 744, 711, 710],
    [7.667, 969, 672, 580], [7.75, 1410, 594, 310], [7.833, ...DOCKS[2], DOCK_RADIUS]] },
  { label: 'Taste', okAt: 7.67, leaveAt: 7.75, phase: 130, keys: [
    [6.95, 966, 519, 20], [7.0, 966, 519, 40], [7.25, 990, 450, 80], [7.292, 1035, 360, 160], [7.333, 1065, 96, 1000],
    [7.75, 1065, 90, 1000], [7.833, 1170, 195, 870], [7.917, 1404, 420, 580], [8.0, 1635, 654, 245], [8.083, ...DOCKS[3], DOCK_RADIUS]] },
  { label: 'Smell', okAt: 7.875, leaveAt: 7.917, phase: 200, keys: [
    [7.45, 700, 700, 40], [7.5, 700, 700, 60], [7.583, 420, 760, 260], [7.625, 165, 810, 1000], [7.917, 180, 810, 1000],
    [8.0, 546, 846, 780], [8.083, 1320, 924, 300], [8.167, ...DOCKS[4], DOCK_RADIUS]] },
];

/** Radius is interpolated in log space so zooms look like a camera move, not a linear scale. */
const TRACKS = SENSES.map(sense => sense.keys.map(([t, x, y, radius]) => ({ t, value: [x, y, Math.log(radius)] })));

function senseState(index: number, t: number): DialState {
  const sense = SENSES[index];
  const [x, y, logRadius] = sampleTrack(TRACKS[index], t);
  const scatter = sampleTrack(index % 2 === 0 ? SCATTER_LEFT : SCATTER_RIGHT, t)[0];
  return {
    x: x + scatter, y, radius: Math.exp(logRadius),
    alpha: clamp01((t - sense.keys[0][0]) / FADE_IN),
    label: sense.label,
    ok: progress(t, sense.okAt - 0.04, sense.okAt + 0.04),
    green: easeInQuad(progress(t, GREEN_START, GREEN_END)),
    time: t, phase: sense.phase,
  };
}

/** Departing dials pass in front; among approaching ones the earlier sense stays on top. */
function drawOrder(t: number): number[] {
  const rank = (index: number) => (t >= SENSES[index].leaveAt ? 10 : 0) - index;
  return SENSES.map((_, index) => index).sort((a, b) => rank(a) - rank(b));
}

export function drawSensors(ctx: CanvasRenderingContext2D, t: number, pixel: number) {
  if (t > SCATTER_START + 0.3) return;
  for (const index of drawOrder(t)) {
    if (t < SENSES[index].keys[0][0]) continue;
    drawDial(ctx, senseState(index, t), pixel);
  }
}
