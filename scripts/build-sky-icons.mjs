// Generates the Sky theme's menu icons in public/sky-art from Lucide line glyphs (ISC).
// Root buttons: 120x120 ring + disc like the SAO vector set. Items: 100x100 disc.
// Normal faces are white/pale with a blue-grey line; active faces are sky blue with a white line.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const LUCIDE_ICONS = 'node_modules/lucide-react/dist/esm/icons';
const OUTPUT = 'public/sky-art';
const LUCIDE_GRID = 24;

const COLORS = {
  accent: '#4FB8EE',
  ring: '#BFE6FA',
  white: '#FFFFFF',
  itemDisc: '#E6F4FC',
  line: '#4A6B80',
};
// Glyph size inside the disc, and stroke in Lucide grid units (thin, ~1-1.3px on screen).
const ROOT = { viewBox: 120, glyph: 48, stroke: 1.5 };
const ITEM = { viewBox: 100, glyph: 60, stroke: 1.75 };

const ICONS = {
  root: { player: 'user', party: 'users', message: 'message-circle', navigation: 'compass', settings: 'settings' },
  item: { items: 'backpack', skills: 'sparkles', equipment: 'shield', option: 'sliders-horizontal', help: 'circle-help', logout: 'log-out' },
};

async function lucideNode(name) {
  const source = await readFile(path.join(LUCIDE_ICONS, `${name}.js`), 'utf8');
  const match = source.match(/createLucideIcon\("[^"]+", (\[[\s\S]*?\])\);/);
  if (!match) throw new Error(`Unrecognised Lucide icon module: ${name}`);
  return JSON.parse(match[1].replace(/(\w+):/g, '"$1":').replace(/"(\w+)"\s*:\s*"/g, '"$1": "'));
}

const attributes = attrs => Object.entries(attrs).filter(([key]) => key !== 'key').map(([key, value]) => `${key}="${value}"`).join(' ');

function glyph(node, { glyph: size, stroke }, center, color) {
  const scale = size / LUCIDE_GRID;
  const offset = center - size / 2;
  const shapes = node.map(([tag, attrs]) => `<${tag} ${attributes(attrs)} />`).join('');
  return `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${shapes}</g>`;
}

function rootSvg(node, isActive) {
  const center = ROOT.viewBox / 2;
  const fill = isActive ? COLORS.accent : COLORS.white;
  const ring = isActive ? COLORS.accent : COLORS.ring;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ROOT.viewBox} ${ROOT.viewBox}">`
    + `<circle cx="${center}" cy="${center}" r="58.75" fill="none" stroke="${ring}" stroke-width="2.5" />`
    + `<circle cx="${center}" cy="${center}" r="50" fill="${fill}" />`
    + glyph(node, ROOT, center, isActive ? COLORS.white : COLORS.line)
    + '</svg>\n';
}

function itemSvg(node, isActive) {
  const center = ITEM.viewBox / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ITEM.viewBox} ${ITEM.viewBox}">`
    + `<circle cx="${center}" cy="${center}" r="50" fill="${isActive ? COLORS.accent : COLORS.itemDisc}" />`
    + glyph(node, ITEM, center, isActive ? COLORS.white : COLORS.line)
    + '</svg>\n';
}

await mkdir(OUTPUT, { recursive: true });
for (const [kind, icons] of Object.entries(ICONS)) {
  const render = kind === 'root' ? rootSvg : itemSvg;
  for (const [name, lucide] of Object.entries(icons)) {
    const node = await lucideNode(lucide);
    await writeFile(path.join(OUTPUT, `${name}.svg`), render(node, false));
    await writeFile(path.join(OUTPUT, `${name}-active.svg`), render(node, true));
  }
}
console.log(`Wrote Sky icons to ${OUTPUT}`);
