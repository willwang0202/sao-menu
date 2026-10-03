import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve('public/sao-original');
let manifest;
try { manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')); }
catch { throw new Error('Import the original Steam resources first: npm run import:assets -- "/path/to/SAO Utils 2"'); }
const required = [
  'menu.xml', 'launcher-theme.xml', 'Fonts/SAOUI-Regular.otf', 'Fonts/SourceHanSans-Medium.otf',
  'Images/background/btn.png', 'Images/background/btn-hovered.png', 'Images/background/btn-pressed.png',
  'Images/background/btn-mask.png', 'Images/background/btn-mask-checked.png',
  'Images/background/item.png', 'Images/background/item-hovered.png', 'Images/background/item-pressed.png',
  'Images/background/item-selected.png', 'Images/background/item-mask.png',
  'Images/etc/panel.png', 'Images/etc/panel-shadow.png', 'Images/etc/info.png',
  'Images/etc/indicator-upper.png', 'Images/etc/indicator-lower.png',
  'Sounds/Feedback.SAO.Click.wav', 'Sounds/Popup.SAO.Launcher.wav', 'Sounds/Popup.SAO.Menu.wav',
  'Sounds/Popup.SAO.Panel.wav', 'Sounds/Dismiss.SAO.Launcher.wav',
  'notices/LICENSE.GPGPL', 'notices/README.EN.txt',
  'System/web-frame.png', 'System/web-close.png', 'System/web-reload.png', 'System/web-stop.png',
  'Media/image-widget.png', 'Media/video-widget.png',
  'Fonts/FontAwesome-Regular.otf',
  'MediaShaders/Fade.glsl', 'MediaShaders/Cube.glsl', 'MediaShaders/InvertedPageCurl.glsl', 'Media/gallery-widget.png',
];
await Promise.all(required.map(async name => {
  const asset = manifest.assets?.find(asset => asset.path === name);
  if (!asset) throw new Error(`Original resource missing from the import manifest: ${name}`);
  const bytes = await readFile(path.join(root, name));
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Original resource changed; reimport before building: ${name}`);
}));
const icon = await readFile('resources/icon.png');
if (!manifest.icon?.sha256 || createHash('sha256').update(icon).digest('hex') !== manifest.icon.sha256) {
  throw new Error('The original executable icon is missing or changed. Reimport the Steam resources.');
}
