// Verify the actual packaged ASAR on each native runner, including all original artwork.
import assert from 'node:assert/strict';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import asar from '@electron/asar';

const platform = process.platform;
// Mac and Windows publish one universal package; Linux publishes x86_64.
const arch = platform === 'linux' ? process.arch : 'universal';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const folder = platform === 'darwin' ? 'release/mac-universal/SAO Utils 2.app/Contents/Resources' : `release/${platform === 'win32' ? 'win-unpacked' : 'linux-unpacked'}/resources`;
const archive = path.join(folder, 'app.asar');
const updateConfig = await readFile(path.join(folder, 'app-update.yml'), 'utf8');
assert.match(updateConfig, /owner: willwang0202/); assert.match(updateConfig, /repo: sao-menu/); assert.match(updateConfig, /provider: github/);
assert.equal(JSON.parse(asar.extractFile(archive, path.normalize('node_modules/electron-updater/package.json')).toString()).version, '6.8.9');
const embedded = JSON.parse(asar.extractFile(archive, 'package.json').toString());
assert.equal(embedded.version, pkg.version);
assert.equal(embedded.name, 'sao-menu');
async function files(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await files(file)); else if (entry.isFile()) result.push(file);
  }
  return result;
}
const built = [...await files('dist'), ...await files('dist-desktop')].filter(file => !['gesture-helper', 'location-helper'].includes(path.basename(file)));
// ASAR's directory reader splits on the host path separator, including on Windows.
for (const file of [...built, 'resources/icon.png']) assert.deepEqual(asar.extractFile(archive, path.normalize(file)), await readFile(file), `Packaged bytes differ: ${file}`);
const os = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'windows' : 'linux';
const required = platform === 'darwin' ? ['dmg', 'zip'] : platform === 'win32' ? ['exe'] : ['AppImage'];
const artifacts = [];
for (const extension of required) {
  const artifactArch = platform === 'linux' ? 'x86_64' : arch;
  const name = `sao-menu-${pkg.version}-${os}-${artifactArch}.${extension}`;
  const bytes = await readFile(path.join('release', name));
  assert.ok(bytes.length > 1_000_000, `Installer is unexpectedly small: ${name}`);
  artifacts.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), sha512: createHash('sha512').update(bytes).digest('base64') });
}
await mkdir('output', { recursive: true });
const report = { version: pkg.version, platform, arch, verifiedAt: new Date().toISOString(), packagedFilesMatched: built.length + 1, artifacts };
await writeFile(`output/release-${os}-${arch}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
