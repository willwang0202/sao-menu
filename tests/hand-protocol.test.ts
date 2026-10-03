import test from 'node:test';
import assert from 'node:assert/strict';
import { allowsCameraRequest, parseTrackerConfig, parseTrackerEvent } from '../src/shared/hand/protocol';

test('accepts each well-formed tracker event', () => {
  assert.deepEqual(parseTrackerEvent({ kind: 'status', state: 'running' }), { kind: 'status', state: 'running' });
  assert.deepEqual(parseTrackerEvent({ kind: 'status', state: 'error', message: 'No camera' }), { kind: 'status', state: 'error', message: 'No camera' });
  assert.deepEqual(parseTrackerEvent({ kind: 'summon', x: 0.4, y: 0.6 }), { kind: 'summon', x: 0.4, y: 0.6 });
  assert.deepEqual(parseTrackerEvent({ kind: 'dismiss' }), { kind: 'dismiss' });
  assert.deepEqual(parseTrackerEvent({ kind: 'cursor', x: 0, y: 1, visible: true }), { kind: 'cursor', x: 0, y: 1, visible: true });
  assert.deepEqual(parseTrackerEvent({ kind: 'click', x: 0.5, y: 0.5 }), { kind: 'click', x: 0.5, y: 0.5 });
});

test('drops extra fields from accepted events', () => {
  assert.deepEqual(parseTrackerEvent({ kind: 'dismiss', path: '/bin/sh' }), { kind: 'dismiss' });
});

test('rejects unknown kinds, out-of-range and non-finite coordinates', () => {
  for (const value of [
    null, 'summon', 42, { kind: 'launch' }, { kind: 'summon', x: 1.5, y: 0 }, { kind: 'click', x: Number.NaN, y: 0 },
    { kind: 'cursor', x: 0, y: 0 }, { kind: 'cursor', x: 0, y: Infinity, visible: true }, { kind: 'status', state: 'pwned' },
    { kind: 'status', state: 'error', message: 'x'.repeat(301) }, { kind: 'status', state: 'error', message: 7 },
  ]) assert.equal(parseTrackerEvent(value), null, JSON.stringify(value));
});

test('validates tracker configuration', () => {
  assert.deepEqual(parseTrackerConfig({ fps: 30, menuOpen: true }), { fps: 30, menuOpen: true });
  assert.equal(parseTrackerConfig({ fps: 60, menuOpen: true }), null);
  assert.equal(parseTrackerConfig({ fps: 10 }), null);
});

test('grants camera access only for video requests from the tracker', () => {
  assert.equal(allowsCameraRequest({ isTracker: true, permission: 'media', mediaTypes: ['video'] }), true);
  assert.equal(allowsCameraRequest({ isTracker: true, permission: 'media', mediaType: 'video' }), true);
  assert.equal(allowsCameraRequest({ isTracker: false, permission: 'media', mediaTypes: ['video'] }), false);
  assert.equal(allowsCameraRequest({ isTracker: true, permission: 'media', mediaTypes: ['video', 'audio'] }), false);
  assert.equal(allowsCameraRequest({ isTracker: true, permission: 'media', mediaTypes: [] }), false);
  assert.equal(allowsCameraRequest({ isTracker: true, permission: 'media', mediaType: 'audio' }), false);
  assert.equal(allowsCameraRequest({ isTracker: true, permission: 'geolocation' }), false);
});
