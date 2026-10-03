import test from 'node:test';
import assert from 'node:assert/strict';
import { browserURL, curveInset, pagePoint, mediaKind } from '../src/shared/surfaces';
import { resolveNativeMenu } from '../src/shared/menu';

test('browser URLs cannot navigate to privileged protocols or credential-bearing addresses', () => {
  assert.equal(browserURL('example.com/a'), 'https://example.com/a');
  assert.equal(browserURL('http://127.0.0.1:1234/'), 'http://127.0.0.1:1234/');
  for (const address of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,a', 'sao-media://preview/token', 'https://me:secret@example.com', 'https://example.com/\n']) assert.throws(() => browserURL(address));
});

test('curved page input mapping addresses the underlying page and rejects the transparent rim', () => {
  for (const x of [0, 120, 500, 880, 999]) {
    const inset = curveInset(x, 1000, 640);
    for (const y of [0, 200, 500, 639]) {
      const projected = inset + y / 640 * (640 - inset * 2);
      const mapped = pagePoint(x, projected, 1000, 640);
      assert.ok(mapped && Math.abs(mapped.y - y) <= 1);
    }
    assert.equal(pagePoint(x, inset - 1, 1000, 640), null);
  }
  assert.equal(pagePoint(1000, 50, 1000, 640), null);
});

test('media preview recognizes passive image/video formats and excludes active documents', () => {
  assert.equal(mediaKind('/a/Animated.GIF'), 'image');
  assert.equal(mediaKind('/a/movie.webm'), 'video');
  for (const name of ['page.html', 'script.svg', 'app.js', 'clip.exe']) assert.equal(mediaKind(name), null);
});

test('Party and Message expose social roles instead of filesystem shortcuts', () => {
  const roots = resolveNativeMenu([
    { id: 'party', name: 'Party', kind: 'menu', nativeTarget: 'applications', children: [] },
    { id: 'message', name: 'Message', kind: 'menu', nativeTarget: 'home:Desktop', directory: '/tmp/Desktop', children: [] },
  ], 'darwin', [{ id: 'calc', name: 'Calculator', kind: 'application', target: '/System/Applications/Calculator.app' }], '/tmp');
  assert.equal(roots[0].social, 'friends');
  assert.equal(roots[1].social, 'messages');
  assert.equal(roots[0].nativeTarget, undefined);
  assert.equal(roots[1].directory, undefined);
  assert.deepEqual(roots[0].children, []);
});
