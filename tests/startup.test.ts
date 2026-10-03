import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { STARTUP } from '../src/ui/link-start/timeline';

const sha256 = async (file: string) => createHash('sha256').update(await readFile(file)).digest('hex');

test('the startup audio is the unmodified track of the user-selected reference clip', async () => {
  const manifest = JSON.parse(await readFile('public/startup/manifest.json', 'utf8'));
  assert.equal(manifest.source, 'https://www.youtube.com/watch?v=cCfJvBgAd3E');
  assert.equal(await sha256('public/startup/' + manifest.audio.file), manifest.audio.sha256);
  assert.ok(Math.abs(manifest.audio.duration - STARTUP.end) < 0.01, 'audio and animation end together');
});

test('the reference video is kept for comparison only, outside the bundled public assets', async () => {
  const manifest = JSON.parse(await readFile('public/startup/manifest.json', 'utf8'));
  assert.ok(!manifest.reference.file.startsWith('public/'));
  assert.equal(await sha256(manifest.reference.file), manifest.reference.sha256);
});

test('manifest timing matches the renderer timeline', async () => {
  const manifest = JSON.parse(await readFile('public/startup/manifest.json', 'utf8'));
  assert.equal(manifest.loginHoldSeconds, STARTUP.loginHold);
  assert.equal(manifest.loginResumeSeconds, STARTUP.loginResume);
  assert.equal(manifest.endSeconds, STARTUP.end);
  assert.ok(STARTUP.loginHold < STARTUP.loginResume && STARTUP.loginResume < STARTUP.end);
});
