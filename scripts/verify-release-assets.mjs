// Publication gate: the draft release must hold exactly the three packages, feeds and nothing else,
// with bytes matching the native reports, and the tagged source must have passed every native job.
// Usage: node scripts/verify-release-assets.mjs <reports-directory>
//   The directory holds release-mac-universal.json (local signed build) and the CI
//   release-windows-universal.json and release-linux-x64.json (Actions artifacts).
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createUpdateFeeds, RELEASE_PACKAGES } from '../src/shared/update-feeds.ts';

const REPO = 'willwang0202/sao-menu';
const gh = args => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16_777_216 }));
const directory = process.argv[2];
if (!directory) throw new Error('Usage: node scripts/verify-release-assets.mjs <reports-directory>');
const pkg = JSON.parse(await readFile('package.json', 'utf8')), tag = `v${pkg.version}`;
const commit = execFileSync('git', ['rev-parse', `${tag}^{commit}`], { encoding: 'utf8' }).trim();
const run = gh(['run', 'list', '--repo', REPO, '--workflow', 'release.yml', '--commit', commit, '--limit', '1', '--json', 'databaseId,conclusion,url,headSha'])[0];
assert.equal(run?.headSha, commit, 'No release run for the tagged source'); assert.equal(run.conclusion, 'success', 'Release run did not pass');
const release = gh(['api', `repos/${REPO}/releases`]).find(item => item.tag_name === tag);
assert.ok(release, `No release for ${tag}`);
const assets = new Map(release.assets.map(asset => [asset.name, asset]));
const reports = await Promise.all(['mac-universal', 'windows-universal', 'linux-x64'].map(async name => JSON.parse(await readFile(path.join(directory, `release-${name}.json`), 'utf8'))));
const installers = reports.flatMap(report => report.artifacts);
for (const artifact of installers) {
  assert.equal(assets.get(artifact.name)?.size, artifact.bytes, `Installer size differs: ${artifact.name}`);
  assert.equal(assets.get(artifact.name)?.digest, `sha256:${artifact.sha256}`, `Installer checksum differs: ${artifact.name}`);
}
const feeds = createUpdateFeeds(reports, pkg.version);
for (const [name, expected] of Object.entries(feeds)) {
  const remote = JSON.parse(execFileSync('gh', ['release', 'download', tag, '--repo', REPO, '--pattern', name, '--output', '-'], { encoding: 'utf8' }));
  assert.deepEqual(remote, expected, `Feed does not match final installers: ${name}`);
}
const allowed = [...installers.map(artifact => artifact.name), ...Object.keys(feeds)].sort();
assert.deepEqual([...assets.keys()].sort(), allowed, 'The release must hold only the three packages and their update feeds');
assert.equal(Object.values(RELEASE_PACKAGES).flat().length, installers.length);
await writeFile('output/release-status.json', JSON.stringify({ version: pkg.version, sourceCommit: commit, release: release.html_url, nativeRun: run.url, installers, updateFeedsVerified: Object.keys(feeds), assets: allowed }, null, 2) + '\n');
console.log(`PASS: ${tag} at ${commit.slice(0, 7)} holds only ${allowed.length} files; every installer and feed matches its native report.`);
