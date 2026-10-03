import test from 'node:test';
import assert from 'node:assert/strict';
import * as layout from '../src/shared/surface-layout';

test('surface restoration keeps only passive local sources and bounded geometry', () => {
  assert.equal(typeof layout.normalizeLayouts, 'function');
  const bounds = { x: -120, y: 42, width: 640, height: 360 };
  const entries = layout.normalizeLayouts([
    { kind: 'image', source: '/tmp/photo.png', bounds },
    { kind: 'browser', source: 'https://example.com/', bounds },
    { kind: 'gallery', source: '/tmp/pictures', bounds },
    { kind: 'image', source: '/tmp/script.svg', bounds },
    { kind: 'video', source: '/tmp/movie.png', bounds },
    { kind: 'browser', source: 'file:///etc/passwd', bounds },
    { kind: 'image', source: 'relative.png', bounds },
    { kind: 'image', source: '/tmp/photo.png', bounds: { ...bounds, width: NaN } },
  ]);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0].bounds, bounds);
  assert.deepEqual(entries[0].presentation, { fill: 'contain', muted: false, autoResize: true });
  assert.equal(entries[2].gallery?.animateTime, 1000);
  assert.equal(entries[2].gallery?.stillTime, 5000);
  assert.equal(entries[2].gallery?.transition, 'random');
  assert.equal(layout.normalizeLayouts(Array(20).fill(entries[0])).length, 12);
});

test('gallery settings accept only bundled transitions, passive frames and original timing choices', () => {
  assert.equal(typeof layout.normalizeGallery, 'function');
  const settings = layout.normalizeGallery({ transition: '../../evil', frame: '../evil.png', fillColor: 'url(file:///x)', animateTime: -9, stillTime: Infinity });
  assert.equal(settings.transition, 'random');
  assert.equal(settings.frame, '');
  assert.equal(settings.fillColor, 'transparent');
  assert.equal(settings.animateTime, 1000);
  assert.equal(settings.stillTime, 5000);
  assert.equal(layout.normalizeGallery({ transition: 'Cube.glsl', frame: 'compact-white.9.png', fill: 'contain', fillColor: '#e0e0e0', animateTime: 2000, stillTime: 15000 }).transition, 'Cube.glsl');
});
