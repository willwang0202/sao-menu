import test from 'node:test';
import assert from 'node:assert/strict';
import { clockTime, followAudio, holdClock, resumeClock, shouldResyncAudio, startClock } from '../src/ui/link-start/clock';
import { coverTransform } from '../src/ui/link-start/viewport';
import { seededRandom } from '../src/ui/link-start/random';
import { sampleTrack } from '../src/ui/link-start/keyframes';
import { STARTUP, sceneAt } from '../src/ui/link-start/timeline';

test('clock advances with the display timestamp rather than in fixed frame steps', () => {
  const clock = startClock(1_000);
  assert.equal(clockTime(clock, 1_000), 0);
  assert.ok(Math.abs(clockTime(clock, 1_008.333) - 0.008333) < 1e-9, '120Hz frames advance by their real interval');
  assert.equal(clockTime(clock, 3_500), 2.5);
});

test('holding freezes the clock and resuming continues from the requested time', () => {
  const held = holdClock(startClock(0), STARTUP.loginHold);
  assert.equal(clockTime(held, 99_000), STARTUP.loginHold);
  const resumed = resumeClock(held, 50_000, STARTUP.loginResume);
  assert.equal(clockTime(resumed, 50_000), STARTUP.loginResume);
  assert.equal(clockTime(resumed, 50_500), STARTUP.loginResume + 0.5);
});

test('clock transitions return new objects without mutating the original', () => {
  const clock = startClock(10);
  const snapshot = { ...clock };
  holdClock(clock, 4);
  resumeClock(clock, 20, 5);
  assert.deepEqual(clock, snapshot);
});

test('audio is only re-seeked when it drifts beyond tolerance', () => {
  assert.equal(shouldResyncAudio(5.0, 5.05), false);
  assert.equal(shouldResyncAudio(5.0, 5.3), true);
  assert.equal(shouldResyncAudio(5.3, 5.0), true);
});

test('cover transform fills the display with the 16:9 reference frame', () => {
  assert.deepEqual(coverTransform(1920, 1080), { scale: 1, x: 0, y: 0 });
  const wide = coverTransform(3440, 1440);
  assert.equal(wide.scale, 3440 / 1920);
  assert.equal(wide.x, 0);
  assert.ok(wide.y < 0, 'ultrawide crops top and bottom');
  const tall = coverTransform(1512, 982);
  assert.equal(tall.scale, 982 / 1080);
  assert.ok(tall.x < 0 && tall.y === 0, '16:10 crops the sides');
});

test('seeded random produces the same sequence for the same seed', () => {
  const first = seededRandom(42), second = seededRandom(42), other = seededRandom(7);
  const a = Array.from({ length: 5 }, first), b = Array.from({ length: 5 }, second);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, Array.from({ length: 5 }, other));
  assert.ok(a.every(value => value >= 0 && value < 1));
});

test('keyframe tracks hold their ends and interpolate between keys', () => {
  const track = [{ t: 1, value: [0, 10] }, { t: 3, value: [20, 30] }] as const;
  assert.deepEqual(sampleTrack(track, 0), [0, 10]);
  assert.deepEqual(sampleTrack(track, 2), [10, 20]);
  assert.deepEqual(sampleTrack(track, 9), [20, 30]);
});

test('scene boundaries follow the reference clip order', () => {
  assert.equal(sceneAt(0.5), 'dark');
  assert.equal(sceneAt(3.5), 'tunnel');
  assert.equal(sceneAt(6.5), 'sensors');
  assert.equal(sceneAt(9.6), 'language');
  assert.equal(sceneAt(STARTUP.loginHold), 'login');
  assert.equal(sceneAt(12.5), 'registration');
  assert.equal(sceneAt(15), 'welcome');
  assert.equal(sceneAt(17.5), 'warp');
  assert.equal(sceneAt(STARTUP.end + 1), 'done');
});

test('the clock eases toward the audio position instead of jumping', () => {
  const clock = startClock(0);
  // Audio reports 0.9s while the display clock says 1.0s: the picture is 100ms ahead.
  const nudged = followAudio(clock, 1_000, 0.9);
  const time = clockTime(nudged, 1_000);
  assert.ok(time < 1.0 && time > 0.9, `moves part of the way: ${time}`);
  let converged = clock;
  for (let frame = 0; frame < 120; frame++) converged = followAudio(converged, 1_000, 0.9);
  assert.ok(Math.abs(clockTime(converged, 1_000) - 0.9) <= 0.004, 'locks onto the audio, within the jitter dead-band, in a second at 120Hz');
});

test('the clock ignores audio jitter below a few milliseconds', () => {
  const clock = startClock(0);
  assert.equal(followAudio(clock, 1_000, 0.998), clock);
});

test('a held clock is never moved by audio', () => {
  const held = holdClock(startClock(0), 10.62);
  assert.equal(followAudio(held, 50_000, 3), held);
});
