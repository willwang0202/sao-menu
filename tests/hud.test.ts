import test from 'node:test';
import assert from 'node:assert/strict';
import { hpProgress } from '../src/shared/hud';

test('original HP preset reports CPU and RAM headroom without inventing unavailable values', () => {
  assert.deepEqual(hpProgress({ cpuPercent: 25, memoryUsed: 2, memoryTotal: 8 }), { cpu: .75, ram: .75 });
  assert.deepEqual(hpProgress({ cpuPercent: null, memoryUsed: null, memoryTotal: null }), { cpu: null, ram: null });
  assert.deepEqual(hpProgress({ cpuPercent: 120, memoryUsed: 20, memoryTotal: 10 }), { cpu: 0, ram: 0 });
  assert.deepEqual(hpProgress({ cpuPercent: NaN, memoryUsed: 0, memoryTotal: 0 }), { cpu: null, ram: null });
});
