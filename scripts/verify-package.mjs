import assert from 'node:assert/strict';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import asar from '@electron/asar';

const app = path.resolve('release/mac-arm64/SAO Menu.app');
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
const NATIVE_HELPERS = ['gesture-helper', 'location-helper'];
const renderer = await files('dist');
const built = [...renderer, ...(await files('dist-desktop')).filter(file => !NATIVE_HELPERS.includes(path.basename(file))), 'resources/icon.png'];
for (const file of built) assert.deepEqual(asar.extractFile(archive, file.split(path.sep).join('/')), await readFile(file), `Packaged file differs: ${file}`);
const packagedRenderer = asar.listPackage(archive).filter(file => file.startsWith('/dist/') && !asar.statFile(archive, file.slice(1)).files);
assert.equal(packagedRenderer.length, renderer.length, 'Archive contains obsolete renderer files');
// Signing rewrites the helper's signature, so compare its machine code and strings per architecture instead of raw bytes.
const sections = file => ['arm64', 'x86_64'].flatMap(arch => [['-t'], ['-s', '__TEXT', '__cstring']].map(args => execFileSync('otool', ['-arch', arch, ...args, file]).toString().split('\n').slice(1).join('\n')));
for (const name of NATIVE_HELPERS) assert.deepEqual(sections(path.join(resources, name)), sections(`dist-desktop/${name}`), `Packaged ${name} code differs`);
execFileSync('codesign', ['--verify', '--deep', '--strict', app]);
// codesign -d reports on stderr; an ad-hoc or missing identity is recorded as unsigned.
const authority = spawnSync('codesign', ['-dvv', app], { encoding: 'utf8' }).stderr.match(/^Authority=(Developer ID Application: .*)$/m)?.[1] ?? null;
const gatekeeper = spawnSync('spctl', ['-a', '-vv', '-t', 'exec', app], { encoding: 'utf8' }).stderr.match(/^source=(.*)$/m)?.[1] ?? 'unknown';
assert.deepEqual(await readFile(path.join(resources, 'icon.icns')), await readFile('resources/icon.icns'));
const zip = path.resolve(`release/sao-menu-${packageInfo.version}-mac-arm64.zip`);
const dmg = path.resolve(`release/sao-menu-${packageInfo.version}-mac-arm64.dmg`);
const dmgSHA256 = await readFile(dmg).then(bytes => createHash('sha256').update(bytes).digest('hex'), () => null);
const report = { verifiedAt: new Date().toISOString(), version: packageInfo.version, gitTag: `v${packageInfo.version}`, app, zip, packagedFilesMatched: built.length, rendererFiles: renderer.length, gestureHelperMatches: true, signedBy: authority, gatekeeper, originalIconMatches: true, appArchiveSHA256: createHash('sha256').update(await readFile(archive)).digest('hex'), zipSHA256: createHash('sha256').update(await readFile(zip)).digest('hex'), ...(dmgSHA256 ? { dmg, dmgSHA256 } : {}), nativeAcceptanceReport: 'docs/verification.md', onlineService: 'https://sao-menu.favioon.com' };
await mkdir('output', { recursive: true });
await writeFile('output/current-package.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
