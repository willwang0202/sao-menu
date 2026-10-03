import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPoint } from '../src/shared/hand/one-euro';

const PARAMS = { minCutoff: 1.2, beta: 7, dCutoff: 1 };

test('returns the first sample unchanged', () => {
  const { value } = filterPoint(null, { x: 0.3, y: 0.6 }, 0, PARAMS);
  assert.deepEqual(value, { x: 0.3, y: 0.6 });
});

test('smooths jitter around a stationary point', () => {
  let result = filterPoint(null, { x: 0.5, y: 0.5 }, 0, PARAMS);
  let maxDeviation = 0;
  for (let frame = 1; frame <= 60; frame++) {
    const jitter = frame % 2 ? 0.01 : -0.01;
    result = filterPoint(result.state, { x: 0.5 + jitter, y: 0.5 - jitter }, frame * 33, PARAMS);
    maxDeviation = Math.max(maxDeviation, Math.abs(result.value.x - 0.5));
  }
  assert.ok(maxDeviation < 0.006, `jitter deviation ${maxDeviation}`);
});

test('follows fast motion closely', () => {
  let result = filterPoint(null, { x: 0, y: 0.5 }, 0, PARAMS);
  for (let frame = 1; frame <= 10; frame++) result = filterPoint(result.state, { x: frame * 0.05, y: 0.5 }, frame * 33, PARAMS);
  assert.ok(result.value.x > 0.4, `lagged to ${result.value.x}`);
});

test('ignores samples that do not advance time and never mutates prior state', () => {
  const first = filterPoint(null, { x: 0.2, y: 0.2 }, 100, PARAMS);
  const snapshot = structuredClone(first.state);
  const repeat = filterPoint(first.state, { x: 0.9, y: 0.9 }, 100, PARAMS);
  assert.deepEqual(repeat.value, { x: 0.2, y: 0.2 });
  filterPoint(first.state, { x: 0.4, y: 0.4 }, 133, PARAMS);
  assert.deepEqual(first.state, snapshot);
});
