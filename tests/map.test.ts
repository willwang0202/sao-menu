import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHelperLocation, resolveMapPosition, normalizeMapHome, parseGeocode } from '../src/shared/map';
import { normalizeSettings } from '../src/shared/settings';

test('reads a Core Location fix from the helper', () => {
  assert.deepEqual(parseHelperLocation('{"latitude":25.03,"longitude":121.56,"accuracy":65}\n'), { ok: true, latitude: 25.03, longitude: 121.56, accuracy: 65 });
  assert.deepEqual(parseHelperLocation('{"error":"denied"}'), { ok: false, error: 'denied' });
  assert.deepEqual(parseHelperLocation('{"latitude":200,"longitude":0}'), { ok: false, error: 'unavailable' });
  assert.deepEqual(parseHelperLocation('garbage'), { ok: false, error: 'unavailable' });
});

test('falls back to the saved home when the device position is unavailable', () => {
  const home = { label: 'Taipei', latitude: 25.03, longitude: 121.56 };
  assert.deepEqual(resolveMapPosition({ ok: true, latitude: 1, longitude: 2, accuracy: 10 }, home), { latitude: 1, longitude: 2, accuracy: 10, source: 'device' });
  assert.deepEqual(resolveMapPosition({ ok: false, error: 'denied' }, home), { latitude: 25.03, longitude: 121.56, source: 'home', label: 'Taipei', reason: 'denied' });
  assert.deepEqual(resolveMapPosition({ ok: false, error: 'timeout' }, undefined), { source: 'none', reason: 'timeout' });
});

test('home locations are validated when stored', () => {
  assert.deepEqual(normalizeMapHome({ label: ' Tokyo ', latitude: 35.68, longitude: 139.76 }), { label: 'Tokyo', latitude: 35.68, longitude: 139.76 });
  assert.equal(normalizeMapHome({ label: 'x', latitude: 95, longitude: 0 }), undefined);
  assert.equal(normalizeMapHome('Tokyo'), undefined);
  assert.equal(normalizeSettings({ mapHome: { label: 'Tokyo', latitude: 35.68, longitude: 139.76 } }, 'darwin').mapHome?.label, 'Tokyo');
  assert.equal(normalizeSettings({}, 'darwin').mapHome, undefined);
});

test('reads the first place from an OpenStreetMap search response', () => {
  assert.deepEqual(parseGeocode([{ display_name: 'Taipei, Taiwan', lat: '25.0375', lon: '121.5637' }]), { label: 'Taipei, Taiwan', latitude: 25.0375, longitude: 121.5637 });
  assert.equal(parseGeocode([]), undefined);
  assert.equal(parseGeocode({ error: 'x' }), undefined);
});
