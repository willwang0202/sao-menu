// Verify the actual packaged ASAR on each native runner, including all original artwork.
import assert from 'node:assert/strict';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import asar from '@electron/asar';

const platform = process.platform;
const arch = process.arch;
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const folder = platform === 'darwin' ? `release/${arch === 'arm64' ? 'mac-arm64' : 'mac'}/SAO Utils 2.app/Contents/Resources` : `release/${platform === 'win32' ? 'win-unpacked' : 'linux-unpacked'}/resources`;
const archive = path.join(folder, 'app.asar');
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
const built = [...await files('dist'), ...await files('dist-desktop')].filter(file => path.basename(file) !== 'gesture-helper');
for (const file of [...built, 'resources/icon.png']) assert.deepEqual(asar.extractFile(archive, file.split(path.sep).join('/')), await readFile(file), `Packaged bytes differ: ${file}`);
const os = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'windows' : 'linux';
const required = platform === 'darwin' ? ['dmg', 'zip'] : platform === 'win32' ? ['exe', 'zip'] : ['AppImage', 'deb'];
const artifacts = [];
for (const extension of required) {
  const name = `sao-menu-${pkg.version}-${os}-${arch}.${extension}`;
  const bytes = await readFile(path.join('release', name));
  assert.ok(bytes.length > 1_000_000, `Installer is unexpectedly small: ${name}`);
  artifacts.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await mkdir('output', { recursive: true });
const report = { version: pkg.version, platform, arch, verifiedAt: new Date().toISOString(), packagedFilesMatched: built.length + 1, artifacts };
await writeFile(`output/release-${os}-${arch}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
