// Keep imported Steam artwork out of Git while making tagged builds reproducible.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await import('./check-original-assets.mjs');
await import('./prepare-hand-model.mjs');
await mkdir('release', { recursive: true });
const file = 'sao-menu-build-assets.tgz';
execFileSync('tar', ['--exclude=.DS_Store', '-czf', `release/${file}`, 'public/sao-original', 'public/mediapipe'], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
const sha256 = createHash('sha256').update(await readFile(`release/${file}`)).digest('hex');
await writeFile('resources/release-assets.json', JSON.stringify({ version: pkg.version, file, sha256 }, null, 2) + '\n');
console.log(`Staged ${file}: ${sha256}`);
