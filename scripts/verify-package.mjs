import assert from 'node:assert/strict';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import asar from '@electron/asar';

const app = path.resolve('release/mac-arm64/SAO Utils 2.app');
const resources = path.join(app, 'Contents/Resources');
const archive = path.join(resources, 'app.asar');
const packageInfo = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(JSON.parse(asar.extractFile(archive, 'package.json').toString()).version, packageInfo.version, 'Packaged version differs');
async function files(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const name = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await files(name)); else if (entry.isFile()) result.push(name);
  }
  return result;
}
const renderer = await files('dist');
const built = [...renderer, ...(await files('dist-desktop')).filter(file => path.basename(file) !== 'gesture-helper'), 'resources/icon.png'];
for (const file of built) assert.deepEqual(asar.extractFile(archive, file.split(path.sep).join('/')), await readFile(file), `Packaged file differs: ${file}`);
const packagedRenderer = asar.listPackage(archive).filter(file => file.startsWith('/dist/') && !asar.statFile(archive, file.slice(1)).files);
assert.equal(packagedRenderer.length, renderer.length, 'Archive contains obsolete renderer files');
assert.deepEqual(await readFile(path.join(resources, 'gesture-helper')), await readFile('dist-desktop/gesture-helper'));
assert.deepEqual(await readFile(path.join(resources, 'icon.icns')), await readFile('resources/icon.icns'));
const zip = path.resolve(`release/SAO Utils 2-${packageInfo.version}-arm64.zip`);
const report = { verifiedAt: new Date().toISOString(), version: packageInfo.version, gitTag: `v${packageInfo.version}`, app, zip, packagedFilesMatched: built.length, rendererFiles: renderer.length, gestureHelperMatches: true, originalIconMatches: true, appArchiveSHA256: createHash('sha256').update(await readFile(archive)).digest('hex'), zipSHA256: createHash('sha256').update(await readFile(zip)).digest('hex'), socialNativeAcceptance: 'pending', onlineService: 'not deployed' };
await mkdir('output', { recursive: true });
await writeFile('output/current-package.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
