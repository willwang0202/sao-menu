import test from 'node:test';
import assert from 'node:assert/strict';
import { displayFrameRate, pointerInterval } from '../src/shared/refresh';
test('display-driven sampling preserves 60/120/144Hz and variable-rate fallback', () => {
  assert.equal(displayFrameRate(60),60); assert.equal(displayFrameRate(120),120);
  assert.equal(displayFrameRate(143.98),144);
  for (const unknown of [0,undefined,null,NaN,Infinity,-20]) assert.equal(displayFrameRate(unknown),60);
  assert.equal(pointerInterval(120),8); assert.equal(pointerInterval(60),16);
});
test('offscreen target respects the Electron ceiling without limiting common high-refresh displays', () => {
  assert.equal(displayFrameRate(240),240); assert.equal(displayFrameRate(360),240);
  assert.equal(displayFrameRate(30),30);
});
