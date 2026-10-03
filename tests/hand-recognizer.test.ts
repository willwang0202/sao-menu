import test from 'node:test';
import assert from 'node:assert/strict';
import { initialRecognizerState, recognize, type RecognizerEvent, type RecognizerState } from '../src/shared/hand/recognizer';
import type { HandFrame } from '../src/shared/hand/landmarks';
import { makeHand, SHAPES } from './fixtures/hand';

interface Step { t: number; hand: HandFrame | null; menuOpen: boolean; origin?: { x: number; y: number } }

function run(steps: Step[], state: RecognizerState = initialRecognizerState()) {
  const events: (RecognizerEvent & { t: number })[] = [];
  let current = state;
  for (const step of steps) {
    const result = recognize(current, step);
    current = result.state;
    events.push(...result.events.map(event => ({ ...event, t: step.t })));
  }
  return { state: current, events, kinds: events.filter(event => event.kind !== 'cursor').map(event => event.kind) };
}

/** Frames every `interval` ms moving the palm centre linearly from `from` to `to`. */
function motion(shape: Parameters<typeof makeHand>[0], from: [number, number], to: [number, number], durationMs: number, menuOpen: boolean, start = 0, interval = 33, scale = 0.2): Step[] {
  const count = Math.max(1, Math.round(durationMs / interval));
  return Array.from({ length: count + 1 }, (_, index) => {
    const progress = index / count;
    return {
      t: start + index * interval, menuOpen,
      hand: makeHand(shape, from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress, scale),
    };
  });
}

test('emits summon when the two-finger pose swipes down 20% within 400ms', () => {
  const { events } = run(motion(SHAPES.summon, [0.5, 0.3], [0.5, 0.5], 400, false));
  const summons = events.filter(event => event.kind === 'summon');
  assert.equal(summons.length, 1);
  // The event reports the fingertip midpoint, which starts 0.23 above the palm centre.
  assert.ok(summons[0].kind === 'summon' && summons[0].y >= 0.07 + 0.15);
});

test('summon also works at the idle 10 fps sampling rate', () => {
  const { kinds } = run(motion(SHAPES.summon, [0.5, 0.3], [0.5, 0.5], 400, false, 0, 100));
  assert.deepEqual(kinds, ['summon']);
});

test('does not summon on an upward, diagonal, slow or wrong-pose swipe', () => {
  assert.deepEqual(run(motion(SHAPES.summon, [0.5, 0.6], [0.5, 0.35], 400, false)).kinds, []);
  assert.deepEqual(run(motion(SHAPES.summon, [0.3, 0.3], [0.6, 0.5], 400, false)).kinds, []);
  assert.deepEqual(run(motion(SHAPES.summon, [0.5, 0.3], [0.5, 0.5], 2000, false)).kinds, []);
  assert.deepEqual(run(motion(SHAPES.open, [0.5, 0.3], [0.5, 0.5], 400, false)).kinds, []);
  assert.deepEqual(run(motion(SHAPES.point, [0.5, 0.3], [0.5, 0.5], 400, false)).kinds, []);
});

test('does not summon while the menu is already open', () => {
  assert.deepEqual(run(motion(SHAPES.summon, [0.5, 0.3], [0.5, 0.5], 400, true)).kinds, []);
});

test('fires summon once per swipe and respects the cooldown', () => {
  const first = motion(SHAPES.summon, [0.5, 0.2], [0.5, 0.7], 500, false);
  const second = motion(SHAPES.summon, [0.5, 0.2], [0.5, 0.45], 300, false, 600);
  assert.deepEqual(run([...first, ...second]).kinds, ['summon']);
});

test('dismisses on an open-hand swipe in either direction while open', () => {
  assert.deepEqual(run(motion(SHAPES.open, [0.3, 0.5], [0.65, 0.5], 300, true)).kinds, ['dismiss']);
  assert.deepEqual(run(motion(SHAPES.open, [0.7, 0.5], [0.35, 0.52], 300, true)).kinds, ['dismiss']);
});

test('dismisses across a blurred open-hand swipe whose middle frame loses the hand', () => {
  const at = (t: number, x: number | null): Step => ({ t, menuOpen: true, hand: x === null ? null : makeHand(SHAPES.open, x, 0.5) });
  assert.deepEqual(run([at(0, 0.30), at(33, 0.31), at(66, null), at(99, null), at(132, 0.52)]).kinds, ['dismiss']);
});

test('dismisses on a modest 20% sideways swipe within 500ms', () => {
  assert.deepEqual(run(motion(SHAPES.open, [0.45, 0.5], [0.25, 0.5], 500, true)).kinds, ['dismiss']);
});

test('does not dismiss when closed, too short, too vertical or pointing', () => {
  assert.deepEqual(run(motion(SHAPES.open, [0.3, 0.5], [0.65, 0.5], 300, false)).kinds, []);
  assert.deepEqual(run(motion(SHAPES.open, [0.4, 0.5], [0.55, 0.5], 300, true)).kinds, []);
  assert.deepEqual(run(motion(SHAPES.open, [0.4, 0.2], [0.65, 0.6], 300, true)).kinds, []);
  assert.deepEqual(run(motion(SHAPES.point, [0.3, 0.5], [0.65, 0.5], 300, true)).kinds, []);
});

test('streams a visible cursor while pointing and hides it once the hand has been gone for the grace period', () => {
  const steps = [...motion(SHAPES.point, [0.5, 0.5], [0.5, 0.5], 99, true), { t: 200, hand: null, menuOpen: true }, { t: 400, hand: null, menuOpen: true }, { t: 433, hand: null, menuOpen: true }];
  const cursors = run(steps).events.filter(event => event.kind === 'cursor');
  assert.equal(cursors.length, 5);
  assert.ok(cursors.slice(0, 4).every(event => event.kind === 'cursor' && event.visible));
  assert.ok(cursors[4].kind === 'cursor' && !cursors[4].visible);
});

const bentIndex = { index: 'bent', middle: 'curled', ring: 'curled', pinky: 'curled' } as const;
const hides = (events: RecognizerEvent[]) => events.filter(event => event.kind === 'cursor' && !event.visible).length;

test('keeps pointing through a frame where the index finger reads slightly bent (recorded flicker)', () => {
  const steps = [
    { t: 0, menuOpen: true, hand: makeHand(SHAPES.point, 0.5, 0.5) },
    { t: 33, menuOpen: true, hand: makeHand(bentIndex, 0.52, 0.5) },
    { t: 66, menuOpen: true, hand: makeHand(SHAPES.point, 0.52, 0.5) },
  ];
  const { events } = run(steps);
  assert.equal(hides(events), 0);
  assert.equal(events.filter(event => event.kind === 'cursor' && event.visible).length, 3, 'the bent frame still moves the cursor');
});

test('a bent index finger alone does not start pointing', () => {
  assert.equal(run([{ t: 0, menuOpen: true, hand: makeHand(bentIndex) }]).events.length, 0);
});

test('keeps the cursor through brief curled-finger and no-hand frames', () => {
  const steps = [
    { t: 0, menuOpen: true, hand: makeHand(SHAPES.point) },
    { t: 33, menuOpen: true, hand: makeHand(SHAPES.fist) },
    { t: 66, menuOpen: true, hand: null },
    { t: 99, menuOpen: true, hand: makeHand(SHAPES.point) },
  ];
  assert.equal(hides(run(steps).events), 0);
});

test('hides after the grace period without pointing, and at once when the menu closes', () => {
  const lost = run([{ t: 0, menuOpen: true, hand: makeHand(SHAPES.point) }, { t: 100, menuOpen: true, hand: makeHand(SHAPES.fist) }, { t: 300, menuOpen: true, hand: makeHand(SHAPES.fist) }]);
  assert.equal(hides(lost.events), 1);
  const closed = run([{ t: 0, menuOpen: true, hand: makeHand(SHAPES.point) }, { t: 33, menuOpen: false, hand: makeHand(SHAPES.point) }]);
  assert.equal(hides(closed.events), 1);
});

/** A pointing frame whose index tip sits at (tipX, tipY); makeHand puts the tip at cx - 0.06, cy - 0.22. */
const pointAt = (t: number, tipX: number, tipY: number, origin?: { x: number; y: number }) =>
  ({ t, menuOpen: true, origin, hand: makeHand(SHAPES.point, tipX + 0.06, tipY + 0.22) });
const lastCursor = (events: RecognizerEvent[]) => {
  const cursor = events.filter(event => event.kind === 'cursor').at(-1);
  assert.ok(cursor?.kind === 'cursor');
  return cursor;
};
const near = (actual: number, expected: number, tolerance = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
/** Holds the tip still long enough for the smoothing filter to settle. */
const settle = (start: number, tipX: number, tipY: number, origin?: { x: number; y: number }) =>
  Array.from({ length: 30 }, (_, index) => pointAt(start + index * 33, tipX, tipY, origin));

test('starts the cursor at the menu origin wherever the hand is when the menu opens', () => {
  const origin = { x: 0.3, y: 0.4 };
  const cursor = lastCursor(run([pointAt(0, 0.8, 0.9, origin)]).events);
  near(cursor.x, 0.3); near(cursor.y, 0.4);
});

test('starts at the screen centre when no origin is given', () => {
  const cursor = lastCursor(run([pointAt(0, 0.1, 0.1)]).events);
  near(cursor.x, 0.5); near(cursor.y, 0.5);
});

test('moves the cursor relative to where the hand started, at the cursor gain', () => {
  const origin = { x: 0.5, y: 0.5 };
  const cursor = lastCursor(run([pointAt(0, 0.6, 0.6, origin), ...settle(33, 0.66, 0.56, origin)]).events);
  near(cursor.x, 0.5 + 0.06 * 1.5); near(cursor.y, 0.5 - 0.04 * 1.5);
});

test('keeps the anchor through a brief tracking dropout, so the cursor does not jump', () => {
  const origin = { x: 0.5, y: 0.5 };
  const before = lastCursor(run([pointAt(0, 0.6, 0.6, origin), ...settle(33, 0.66, 0.6, origin)]).events);
  const steps = [pointAt(0, 0.6, 0.6, origin), ...settle(33, 0.66, 0.6, origin), { t: 1100, hand: null, menuOpen: true, origin }, pointAt(1300, 0.66, 0.6, origin)];
  near(lastCursor(run(steps).events).x, before.x);
});

test('after a long gap the hand re-anchors at the last cursor position', () => {
  const origin = { x: 0.5, y: 0.5 };
  const moved = [pointAt(0, 0.5, 0.5, origin), ...settle(33, 0.6, 0.5, origin)];
  const last = lastCursor(run(moved).events);
  const back = run([...moved, { t: 1100, hand: null, menuOpen: true, origin }, pointAt(2500, 0.2, 0.8, origin)]);
  const cursor = lastCursor(back.events);
  near(cursor.x, last.x); near(cursor.y, last.y);
});

test('rebases at the screen edge so moving back responds immediately', () => {
  const origin = { x: 0.9, y: 0.5 };
  const steps = [pointAt(0, 0.5, 0.5, origin), ...settle(33, 0.7, 0.5, origin), ...settle(1100, 0.64, 0.5, origin)];
  near(lastCursor(run(steps).events).x, 1 - 0.06 * 1.5);
});

test('re-anchors at the new origin when the menu is summoned somewhere else', () => {
  const first = settle(0, 0.6, 0.6, { x: 0.2, y: 0.2 });
  const cursor = lastCursor(run([...first, pointAt(1100, 0.6, 0.6, { x: 0.7, y: 0.6 })]).events);
  near(cursor.x, 0.7); near(cursor.y, 0.6);
});

test('emits no cursor while the menu is closed', () => {
  assert.equal(run(motion(SHAPES.point, [0.5, 0.5], [0.6, 0.5], 200, false)).events.length, 0);
});

function steadyThenPush(pushScale: number, drift = 0, start = 0): Step[] {
  const steady = motion(SHAPES.point, [0.5, 0.5], [0.5, 0.5], 330, true, start);
  const push = motion(SHAPES.point, [0.5, 0.5], [0.5 + drift, 0.5], 200, true, start + 363).map((step, index, all) => ({
    ...step, hand: makeHand(SHAPES.point, 0.5 + drift * (index / (all.length - 1)), 0.5, 0.2 * (1 + (pushScale - 1) * (index / (all.length - 1)))),
  }));
  return [...steady, ...push];
}

test('clicks when the pointing hand pushes forward 15% within 200ms', () => {
  const { events } = run(steadyThenPush(1.15));
  const clicks = events.filter(event => event.kind === 'click');
  assert.equal(clicks.length, 1);
});

test('reports the click at the cursor position from before the push', () => {
  const { events } = run(steadyThenPush(1.15));
  const click = events.find(event => event.kind === 'click');
  const before = events.filter(event => event.kind === 'cursor' && event.t <= 330).at(-1);
  assert.ok(click?.kind === 'click' && before?.kind === 'cursor');
  assert.ok(Math.abs(click.x - before.x) < 0.02 && Math.abs(click.y - before.y) < 0.02);
});

test('does not click on a small push, a pull back, or when the fingertip drifts', () => {
  assert.equal(run(steadyThenPush(1.05)).kinds.length, 0);
  assert.equal(run(steadyThenPush(0.85)).kinds.length, 0);
  assert.equal(run(steadyThenPush(1.15, 0.12)).kinds.length, 0);
});

test('holds the cursor at the click point, then honours the click cooldown', () => {
  const first = steadyThenPush(1.15);
  const last = first.at(-1)!.t;
  const after = run([...first, { t: last + 33, hand: makeHand(SHAPES.point, 0.7, 0.5, 0.23), menuOpen: true }]);
  const click = after.events.find(event => event.kind === 'click');
  const held = after.events.at(-1);
  assert.ok(click?.kind === 'click' && held?.kind === 'cursor');
  assert.equal(held.x, click.x);
  const repeat = run([...first, ...steadyThenPush(1.15, 0, last + 33)]);
  assert.equal(repeat.kinds.filter(kind => kind === 'click').length, 1);
});

/** A frame whose index/middle fingertip midpoint sits at `tipY` (makeHand puts it 0.23 above the palm). */
const atTip = (t: number, shape: Parameters<typeof makeHand>[0] | null, tipY: number): Step =>
  ({ t, menuOpen: false, hand: shape ? makeHand(shape, 0.5, tipY + 0.23) : null });

test('summons across a fast swipe whose middle frames lose the hand (recorded webcam trace)', () => {
  // Frames from a real 10 fps capture: the blurred mid-swipe frame has no hand.
  const trace = [
    atTip(44862, SHAPES.summon, 0.339), atTip(44984, SHAPES.summon, 0.262), atTip(45105, SHAPES.summon, 0.196),
    atTip(45224, SHAPES.summon, 0.144), atTip(45343, SHAPES.summon, 0.171), atTip(45460, null, 0),
    atTip(45588, SHAPES.point, 0.972), atTip(45706, SHAPES.summon, 0.996),
  ];
  assert.deepEqual(run(trace).kinds, ['summon']);
});

test('summons when only the start and end of a blurred swipe show the pose (recorded webcam trace)', () => {
  const trace = [
    atTip(47131, SHAPES.summon, 0.177), atTip(47248, SHAPES.summon, 0.142), atTip(47364, null, 0),
    atTip(47614, SHAPES.open, 0.957), atTip(47738, SHAPES.summon, 0.896),
  ];
  assert.deepEqual(run(trace).kinds, ['summon']);
});

test('does not summon when the two-finger pose reappears lower after the window has passed', () => {
  const trace = [atTip(0, SHAPES.summon, 0.2), atTip(100, null, 0), atTip(1000, SHAPES.summon, 0.8)];
  assert.deepEqual(run(trace).kinds, []);
});

test('summons when the other fingers relax by the end of the swipe (recorded webcam trace)', () => {
  const relaxed = { index: 'extended', middle: 'extended', ring: 'extended', pinky: 'curled' } as const;
  const trace = [
    atTip(6481, SHAPES.summon, 0.492), atTip(6606, SHAPES.summon, 0.434), atTip(6729, SHAPES.point, 0.422),
    atTip(6849, SHAPES.summon, 0.321), atTip(6967, relaxed, 0.610),
  ];
  assert.deepEqual(run(trace).kinds, ['summon']);
});

test('also completes a summon swipe that ends with an open hand', () => {
  assert.deepEqual(run([atTip(0, SHAPES.summon, 0.2), atTip(120, null, 0), atTip(240, SHAPES.open, 0.6)]).kinds, ['summon']);
});

test('does not summon when the swipe ends without the two fingers extended', () => {
  assert.deepEqual(run([atTip(0, SHAPES.summon, 0.2), atTip(120, SHAPES.point, 0.6)]).kinds, []);
  assert.deepEqual(run([atTip(0, SHAPES.summon, 0.2), atTip(120, SHAPES.fist, 0.6)]).kinds, []);
});

test('an open hand moving down never summons without a two-finger start', () => {
  assert.deepEqual(run(motion(SHAPES.open, [0.5, 0.3], [0.5, 0.6], 400, false)).kinds, []);
});

test('never mutates the previous state', () => {
  const state = initialRecognizerState();
  const snapshot = structuredClone(state);
  recognize(state, { t: 0, hand: makeHand(SHAPES.point), menuOpen: true });
  assert.deepEqual(state, snapshot);
});
