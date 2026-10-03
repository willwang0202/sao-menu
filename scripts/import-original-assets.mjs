import { cp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extractOriginalIcon } from './extract-original-icon.mjs';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/import-original-assets.mjs "/path/to/SAO Utils 2"');
const theme = path.join(source, 'Packages/com.gpbeta.theme.sao');
const icon = await extractOriginalIcon(source);
const destination = path.resolve('public/sao-original');
await mkdir(destination, { recursive: true });
await cp(path.join(theme, 'Images'), path.join(destination, 'Images'), { recursive: true });
await cp(path.join(theme, 'Sounds'), path.join(destination, 'Sounds'), { recursive: true });
await cp(path.join(source, 'Packages/system/Images'), path.join(destination, 'System'), { recursive: true });
await cp(path.join(source, 'Packages/com.gpbeta.media/Images'), path.join(destination, 'Media'), { recursive: true });
await cp(path.join(source, 'Packages/com.gpbeta.media/Shaders/gl-transitions'), path.join(destination, 'MediaShaders'), { recursive: true });
await mkdir(path.join(destination, 'Fonts'), { recursive: true });
await cp(path.join(source, 'Fonts/SAOUI-Regular.otf'), path.join(destination, 'Fonts/SAOUI-Regular.otf'));
await cp(path.join(source, 'Fonts/Font Awesome 5 Pro-Regular-400.otf'), path.join(destination, 'Fonts/FontAwesome-Regular.otf'));
await cp(path.join(source, 'Fonts/SourceHanSans-Medium.ttc'), path.join(destination, 'Fonts/SourceHanSans-Medium.ttc'));
try {
  await promisify(execFile)('python3', ['scripts/extract-cjk-font.py', path.join(destination, 'Fonts/SourceHanSans-Medium.ttc'), path.join(destination, 'Fonts/SourceHanSans-Medium.otf')], { timeout: 30000 });
} catch {
  throw new Error('CJK font extraction needs Python fontTools. Run python3 -m pip install fonttools, then reimport for original CJK glyphs.');
}
await mkdir(path.join(destination, 'notices'), { recursive: true });
await cp(path.join(theme, 'LICENSE.GPGPL'), path.join(destination, 'notices/LICENSE.GPGPL'));
await cp(path.join(source, 'win64/README.EN.txt'), path.join(destination, 'notices/README.EN.txt'));
await cp(path.join(source, 'Configs/system/launcher/menu.xml'), path.join(destination, 'menu.xml'));
await cp(path.join(source, 'Configs/system/launcher/themes/launcher@sao.theme.gpbeta.com.xml'), path.join(destination, 'launcher-theme.xml'));
const assets = [];
async function inventory(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const target = path.join(folder, entry.name);
    if (entry.isDirectory()) await inventory(target);
    else if (entry.isFile() && entry.name !== 'manifest.json' && entry.name !== '.DS_Store') {
      const bytes = await readFile(target);
      assets.push({ path: path.relative(destination, target).split(path.sep).join('/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
}
await inventory(destination);
await rm(path.join(destination, 'Fonts/SourceHanSans-Medium.ttc'), { force: true });
const runtimeAssets = assets.filter(asset => asset.path !== 'Fonts/SourceHanSans-Medium.ttc');
await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({ source: 'User-supplied SAO Utils 2 installation', theme: 'com.gpbeta.theme.sao', purpose: 'Local visual and audio compatibility', importedAt: new Date().toISOString(), icon, assets: runtimeAssets }, null, 2));
console.log(`Imported ${runtimeAssets.length} theme resources into public/sao-original. Original notices preserved.`);
