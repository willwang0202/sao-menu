// Publication gate: GitHub asset bytes must agree with the native reports and source tag.
// Usage: node scripts/verify-release-assets.mjs <github-assets.json> <native-run.json>
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const json = async file => JSON.parse(await readFile(file, 'utf8'));
const pkg = await json('package.json'), remote = await json(process.argv[2]), run = await json(process.argv[3]);
const commit = execFileSync('git', ['rev-parse', `v${pkg.version}`], { encoding: 'utf8' }).trim();
assert.equal(run.headSha, commit); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
assert.equal(run.jobs.length, 4);
assert.ok(run.jobs.every(job => job.conclusion === 'success' && job.steps.some(step => step.name.startsWith('Launch packaged') && step.conclusion === 'success')));
const assets = new Map(remote.assets.map(asset => [asset.name, asset]));
const installers = [];
for (const name of ['release-mac-arm64.json', 'release-mac-x64.json', 'release-windows-x64.json', 'release-linux-x64.json']) {
  const bytes = await readFile(`output/${name}`), report = JSON.parse(bytes);
  assert.equal(report.version, pkg.version); assert.ok(report.packagedFilesMatched > 1000);
  assert.equal(assets.get(name)?.digest, `sha256:${createHash('sha256').update(bytes).digest('hex')}`, `Report bytes differ: ${name}`);
  for (const artifact of report.artifacts) {
    assert.equal(assets.get(artifact.name)?.size, artifact.bytes, `Installer size differs: ${artifact.name}`);
    assert.equal(assets.get(artifact.name)?.digest, `sha256:${artifact.sha256}`, `Installer checksum differs: ${artifact.name}`);
    installers.push(artifact);
  }
}
assert.equal(installers.length, 8); assert.equal(new Set(installers.map(artifact => artifact.name)).size, 8);
const bundle = await json('resources/release-assets.json');
assert.equal(bundle.version, pkg.version); assert.equal(assets.get(bundle.file)?.digest, `sha256:${bundle.sha256}`);
installers.sort((a, b) => a.name.localeCompare(b.name));
await writeFile('release/SHA256SUMS', installers.map(artifact => `${artifact.sha256}  ${artifact.name}\n`).join('') + `${bundle.sha256}  ${bundle.file}\n`);
await writeFile('output/release-status.json', JSON.stringify({ version: pkg.version, sourceCommit: commit, release: `https://github.com/willwang0202/sao-menu/releases/tag/v${pkg.version}`, nativeRun: run.url, nativeJobs: run.jobs.map(job => ({ name: job.name, url: job.url, conclusion: job.conclusion })), packagedLaunchesPassed: 4, installerDigestsVerifiedAgainstGitHub: true, website: 'https://sao-menu.favioon.com', installers }, null, 2) + '\n');
console.log('PASS: four native package launches, source tag, all eight installer hashes/sizes and the resource bundle agree with GitHub.');
