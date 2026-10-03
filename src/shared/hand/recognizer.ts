import { LANDMARK, midpoint, PALM_CENTRE, palmScale, type HandFrame, type Point } from './landmarks';
import { filterPoint, type OneEuroParams, type OneEuroState } from './one-euro';
import { classifyPose, fingerState, type Pose } from './pose';

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
/*
 * The cursor is hand-anchored: it starts at the menu origin wherever the hand
 * is, then moves by the hand's displacement times CURSOR_GAIN. Short tracking
 * gaps keep the anchor; after ANCHOR_RESET_MS the hand re-anchors at the last
 * cursor position, like lifting and replacing a mouse.
 */
const CURSOR_GAIN = 1.5;
const ANCHOR_RESET_MS = 500;
const CENTRE: Point = { x: 0.5, y: 0.5 };
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

export interface RecognizerInput {
  t: number;
  hand: HandFrame | null;
  menuOpen: boolean;
  /** Where the menu opened, in normalized overlay coordinates; the cursor starts here. */
  origin?: Point;
}

interface TimedPoint { readonly t: number; readonly point: Point }
interface PushSample { readonly t: number; readonly scale: number; readonly tip: Point; readonly cursor: Point }
interface CursorAnchor { readonly tip: Point; readonly cursor: Point }

export interface RecognizerState {
  readonly summon: readonly TimedPoint[];
  readonly swipe: readonly TimedPoint[];
  readonly push: readonly PushSample[];
  readonly filter: OneEuroState | null;
  readonly cursorVisible: boolean;
  readonly gestureReadyAt: number;
  readonly clickReadyAt: number;
  readonly hold: { readonly until: number; readonly point: Point } | null;
  readonly anchor: CursorAnchor | null;
  readonly anchorSeenAt: number;
  /** Last cursor position, kept while hidden so the hand can re-anchor to it. */
  readonly cursor: Point;
  /** Origin of the current menu session; null while the menu is closed. */
  readonly origin: Point | null;
}

export function initialRecognizerState(): RecognizerState {
  return {
    summon: [], swipe: [], push: [], filter: null, cursorVisible: false, gestureReadyAt: -Infinity, clickReadyAt: -Infinity,
    hold: null, anchor: null, anchorSeenAt: -Infinity, cursor: CENTRE, origin: null,
  };
}

const within = <T extends { t: number }>(samples: readonly T[], t: number, windowMs: number): T[] => samples.filter(sample => t - sample.t <= windowMs);
const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/** A new menu session (or a new origin) restarts the cursor at the origin. */
function syncOrigin(state: RecognizerState, input: RecognizerInput): RecognizerState {
  if (!input.menuOpen) return state.origin ? { ...state, origin: null } : state;
  const origin = input.origin ?? CENTRE;
  if (state.origin && samePoint(state.origin, origin)) return state;
  return { ...state, origin, anchor: null, cursor: origin, filter: null };
}

/** Maps the fingertip through the anchor; at a screen edge the anchor moves so reversing responds at once. */
function anchoredTarget(state: RecognizerState, tip: Point, t: number): { target: Point; anchor: CursorAnchor } {
  const isFresh = state.anchor && t - state.anchorSeenAt <= ANCHOR_RESET_MS;
  const anchor = isFresh && state.anchor ? state.anchor : { tip, cursor: state.cursor };
  const raw = { x: anchor.cursor.x + (tip.x - anchor.tip.x) * CURSOR_GAIN, y: anchor.cursor.y + (tip.y - anchor.tip.y) * CURSOR_GAIN };
  const target = { x: clampUnit(raw.x), y: clampUnit(raw.y) };
  return { target, anchor: samePoint(target, raw) ? anchor : { tip, cursor: target } };
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

/** Fast motion relaxes the other fingers, so a swipe may end on any frame that keeps index and middle up. */
const isTwoFingersUp = (hand: HandFrame) => fingerState(hand, 'index') === 'extended' && fingerState(hand, 'middle') === 'extended';

function stepSummon({ state, events }: Step, input: RecognizerInput, hand: HandFrame, pose: Pose): Step {
  if (input.menuOpen) return { state: { ...state, summon: [] }, events };
  const recent = within(state.summon, input.t, SUMMON_WINDOW_MS);
  const isStartPose = pose === 'summon';
  if (!isStartPose && (recent.length === 0 || !isTwoFingersUp(hand))) return { state: { ...state, summon: recent }, events };
  const point = midpoint(hand, [LANDMARK.INDEX_TIP, LANDMARK.MIDDLE_TIP]);
  const candidates = [...recent, { t: input.t, point }];
  const summon = isStartPose ? candidates : recent;
  const ready = input.t >= state.gestureReadyAt && candidates.length >= SUMMON_MIN_SAMPLES;
  if (!ready || !travelled(candidates, point, 'y', SUMMON_MIN_TRAVEL, true)) return { state: { ...state, summon }, events };
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
  const landmark = hand.landmarks[LANDMARK.INDEX_TIP];
  const tip = { x: landmark.x, y: landmark.y };
  const { target, anchor } = anchoredTarget(step.state, tip, input.t);
  const filtered = filterPoint(step.state.filter, target, input.t, CURSOR_FILTER);
  const base = { ...step.state, filter: filtered.state, cursorVisible: true, anchor, anchorSeenAt: input.t, cursor: filtered.value };
  const pushed = pose === 'point'
    ? stepPush(base, input, hand, tip, filtered.value)
    : { state: { ...base, push: [] }, click: null };
  const hold = pushed.state.hold && input.t < pushed.state.hold.until ? pushed.state.hold : null;
  const shown = hold?.point ?? filtered.value;
  const events: RecognizerEvent[] = [...step.events, { kind: 'cursor', x: shown.x, y: shown.y, visible: true }];
  if (pushed.click) events.push({ kind: 'click', x: pushed.click.x, y: pushed.click.y });
  return { state: { ...pushed.state, hold }, events };
}

/** Pure reducer: one camera frame in, the next state and any gesture events out. */
export function recognize(previous: RecognizerState, input: RecognizerInput): { state: RecognizerState; events: RecognizerEvent[] } {
  const state = syncOrigin(previous, input);
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
