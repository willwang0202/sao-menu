import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
test('the user-selected anime startup movie retains its original bytes and animated login sequence', async () => {
  const manifest=JSON.parse(await readFile('public/startup/manifest.json','utf8'));
  assert.equal(manifest.source,'https://www.youtube.com/watch?v=cCfJvBgAd3E');
  assert.equal(manifest.video.width,1920); assert.equal(manifest.video.height,1080);
  assert.ok(Math.abs(manifest.video.fps-23.976)<.001);
  assert.ok(manifest.loginHoldSeconds>10.5 && manifest.loginHoldSeconds<10.7);
  assert.equal(createHash('sha256').update(await readFile('public/startup/'+manifest.video.file)).digest('hex'),manifest.video.sha256);
});
