import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const metadata = JSON.parse(await readFile('resources/release-assets.json', 'utf8'));
assert.equal(metadata.version, pkg.version, 'Resource bundle must match the tagged version');
if (process.env.RELEASE_TAG) assert.equal(process.env.RELEASE_TAG, `v${pkg.version}`);
const archive = path.resolve('output/release-inputs', metadata.file);
assert.equal(createHash('sha256').update(await readFile(archive)).digest('hex'), metadata.sha256, 'Release resource checksum differs');
const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
assert.ok(entries.length > 0);
for (const entry of entries) {
  assert.ok(/^public\/(sao-original|mediapipe)\//.test(entry), `Unexpected archive member: ${entry}`);
  assert.ok(!entry.includes('\\') && !entry.split('/').includes('..'), 'Invalid resource path');
}
execFileSync('tar', ['-xzf', archive]);
await import('./check-original-assets.mjs');
console.log(`Restored verified assets for v${pkg.version}`);
