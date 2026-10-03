import { LANDMARK, midpoint, PALM_CENTRE, palmScale, type HandFrame, type Point } from './landmarks';
import { filterPoint, type OneEuroParams, type OneEuroState } from './one-euro';
import { classifyPose, type Pose } from './pose';

/* Thresholds are fractions of the camera frame unless named otherwise. */
/*
 * A real swipe crosses the frame in ~250 ms, so at the 10 fps idle rate the
 * blurred middle frames often lose the hand or misread the pose. Summon
 * samples therefore survive dropouts and only age out of the window; a start
 * and an end frame in the two-finger pose are enough.
 */
const SUMMON_WINDOW_MS = 800;
const SUMMON_MIN_SAMPLES = 2;
const SUMMON_MIN_TRAVEL = 0.15;
// Dismiss samples also survive blurred dropout frames (see the summon note above).
const SWIPE_WINDOW_MS = 600;
const SWIPE_MIN_SAMPLES = 2;
const SWIPE_MIN_TRAVEL = 0.18;
/** Cross-axis travel allowed per unit of travel along the swipe axis. */
const MAX_CROSS_RATIO = 0.75;
const GESTURE_COOLDOWN_MS = 800;
const ACTIVE_REGION = { left: 0.15, right: 0.85, top: 0.1, bottom: 0.75 } as const;
const CURSOR_FILTER: OneEuroParams = { minCutoff: 1.2, beta: 7, dCutoff: 1 };
const PUSH_WINDOW_MS = 300;
const PUSH_SCALE_RATIO = 1.12;
const PUSH_MAX_DRIFT = 0.05;
const CLICK_HOLD_MS = 250;
const CLICK_COOLDOWN_MS = 500;

export type RecognizerEvent =
  | { kind: 'summon'; x: number; y: number }
  | { kind: 'dismiss' }
  | { kind: 'cursor'; x: number; y: number; visible: boolean }
  | { kind: 'click'; x: number; y: number };

export interface RecognizerInput { t: number; hand: HandFrame | null; menuOpen: boolean }

interface TimedPoint { readonly t: number; readonly point: Point }
interface PushSample { readonly t: number; readonly scale: number; readonly tip: Point; readonly cursor: Point }

export interface RecognizerState {
  readonly summon: readonly TimedPoint[];
  readonly swipe: readonly TimedPoint[];
  readonly push: readonly PushSample[];
  readonly filter: OneEuroState | null;
  readonly cursorVisible: boolean;
  readonly gestureReadyAt: number;
  readonly clickReadyAt: number;
  readonly hold: { readonly until: number; readonly point: Point } | null;
}

export function initialRecognizerState(): RecognizerState {
  return { summon: [], swipe: [], push: [], filter: null, cursorVisible: false, gestureReadyAt: -Infinity, clickReadyAt: -Infinity, hold: null };
}

const within = <T extends { t: number }>(samples: readonly T[], t: number, windowMs: number): T[] => samples.filter(sample => t - sample.t <= windowMs);
const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

function toCursorSpace(point: Point): Point {
  return {
    x: clampUnit((point.x - ACTIVE_REGION.left) / (ACTIVE_REGION.right - ACTIVE_REGION.left)),
    y: clampUnit((point.y - ACTIVE_REGION.top) / (ACTIVE_REGION.bottom - ACTIVE_REGION.top)),
  };
}

/** True when some earlier sample lies far enough back along `axis` with little cross-axis travel. */
function travelled(samples: readonly TimedPoint[], current: Point, axis: 'x' | 'y', minimum: number, downOnly: boolean): boolean {
  const cross = axis === 'x' ? 'y' : 'x';
  return samples.some(sample => {
    const along = current[axis] - sample.point[axis];
    const distance = downOnly ? along : Math.abs(along);
    return distance >= minimum && Math.abs(current[cross] - sample.point[cross]) <= distance * MAX_CROSS_RATIO;
  });
}

interface Step { state: RecognizerState; events: RecognizerEvent[] }

function stepSummon({ state, events }: Step, input: RecognizerInput, hand: HandFrame, pose: Pose): Step {
  if (input.menuOpen) return { state: { ...state, summon: [] }, events };
  const recent = within(state.summon, input.t, SUMMON_WINDOW_MS);
  if (pose !== 'summon') return { state: { ...state, summon: recent }, events };
  const point = midpoint(hand, [LANDMARK.INDEX_TIP, LANDMARK.MIDDLE_TIP]);
  const summon = [...recent, { t: input.t, point }];
  const ready = input.t >= state.gestureReadyAt && summon.length >= SUMMON_MIN_SAMPLES;
  if (!ready || !travelled(summon, point, 'y', SUMMON_MIN_TRAVEL, true)) return { state: { ...state, summon }, events };
  return {
    state: { ...state, summon: [], gestureReadyAt: input.t + GESTURE_COOLDOWN_MS },
    events: [...events, { kind: 'summon', x: clampUnit(point.x), y: clampUnit(point.y) }],
  };
}

function stepSwipe({ state, events }: Step, input: RecognizerInput, hand: HandFrame, pose: Pose): Step {
  if (!input.menuOpen) return { state: { ...state, swipe: [] }, events };
  const recent = within(state.swipe, input.t, SWIPE_WINDOW_MS);
  if (pose !== 'open') return { state: { ...state, swipe: recent }, events };
  const point = midpoint(hand, PALM_CENTRE);
  const swipe = [...recent, { t: input.t, point }];
  const ready = input.t >= state.gestureReadyAt && swipe.length >= SWIPE_MIN_SAMPLES;
  if (!ready || !travelled(swipe, point, 'x', SWIPE_MIN_TRAVEL, false)) return { state: { ...state, swipe }, events };
  return { state: { ...state, swipe: [], gestureReadyAt: input.t + GESTURE_COOLDOWN_MS }, events: [...events, { kind: 'dismiss' }] };
}

function hideCursor({ state, events }: Step): Step {
  const hidden = { ...state, filter: null, push: [], cursorVisible: false };
  if (!state.cursorVisible) return { state: hidden, events };
  const last = state.filter?.value ?? { x: 0, y: 0 };
  return { state: hidden, events: [...events, { kind: 'cursor', x: last.x, y: last.y, visible: false }] };
}

function stepPush(state: RecognizerState, input: RecognizerInput, hand: HandFrame, tip: Point, cursor: Point): { state: RecognizerState; click: Point | null } {
  const push = [...within(state.push, input.t, PUSH_WINDOW_MS), { t: input.t, scale: palmScale(hand), tip, cursor }];
  const smallest = push.reduce((best, sample) => (sample.scale <= best.scale ? sample : best));
  const current = push[push.length - 1];
  const pushed = current.scale / smallest.scale >= PUSH_SCALE_RATIO;
  const steady = Math.hypot(current.tip.x - smallest.tip.x, current.tip.y - smallest.tip.y) <= PUSH_MAX_DRIFT;
  if (!pushed || !steady || input.t < state.clickReadyAt) return { state: { ...state, push }, click: null };
  return {
    state: { ...state, push: [], hold: { until: input.t + CLICK_HOLD_MS, point: smallest.cursor }, clickReadyAt: input.t + CLICK_HOLD_MS + CLICK_COOLDOWN_MS },
    click: smallest.cursor,
  };
}

function stepCursor(step: Step, input: RecognizerInput, hand: HandFrame, pose: Pose): Step {
  if (!input.menuOpen || (pose !== 'point' && pose !== 'summon')) return hideCursor(step);
  const tip = hand.landmarks[LANDMARK.INDEX_TIP];
  const filtered = filterPoint(step.state.filter, toCursorSpace(tip), input.t, CURSOR_FILTER);
  const base = { ...step.state, filter: filtered.state, cursorVisible: true };
  const pushed = pose === 'point'
    ? stepPush(base, input, hand, { x: tip.x, y: tip.y }, filtered.value)
    : { state: { ...base, push: [] }, click: null };
  const hold = pushed.state.hold && input.t < pushed.state.hold.until ? pushed.state.hold : null;
  const shown = hold?.point ?? filtered.value;
  const events: RecognizerEvent[] = [...step.events, { kind: 'cursor', x: shown.x, y: shown.y, visible: true }];
  if (pushed.click) events.push({ kind: 'click', x: pushed.click.x, y: pushed.click.y });
  return { state: { ...pushed.state, hold }, events };
}

/** Pure reducer: one camera frame in, the next state and any gesture events out. */
export function recognize(state: RecognizerState, input: RecognizerInput): { state: RecognizerState; events: RecognizerEvent[] } {
  if (!input.hand) {
    const summon = input.menuOpen ? [] : within(state.summon, input.t, SUMMON_WINDOW_MS);
    const swipe = input.menuOpen ? within(state.swipe, input.t, SWIPE_WINDOW_MS) : [];
    const cleared = hideCursor({ state: { ...state, summon, swipe }, events: [] });
    return { state: { ...cleared.state, hold: null }, events: cleared.events };
  }
  const pose = classifyPose(input.hand);
  const summoned = stepSummon({ state, events: [] }, input, input.hand, pose);
  const swiped = stepSwipe(summoned, input, input.hand, pose);
  return stepCursor(swiped, input, input.hand, pose);
}
