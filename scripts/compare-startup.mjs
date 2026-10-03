// Renders the procedural Link Start at given media times next to the reference clip's frames.
// Usage: node scripts/compare-startup.mjs 2.5 3.6 4.4   (writes output/startup-compare/)
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const REFERENCE = 'tests/fixtures/startup/link-start-reference.mp4';
const OUTPUT = path.resolve('output/startup-compare');
const WIDTH = 1920, HEIGHT = 1080, PREVIEW_WIDTH = 960;
const times = process.argv.slice(2).map(Number).filter(Number.isFinite);
if (!times.length) throw new Error('Pass one or more media times in seconds.');
await mkdir(OUTPUT, { recursive: true });

const bundle = await build({
  stdin: { contents: "import { renderFrame } from './src/ui/link-start/render';\nwindow.renderAt = (t, options) => { const c = document.querySelector('canvas'); renderFrame(c.getContext('2d'), t, c.width, c.height, options); };", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'iife', target: 'chrome120',
});
const font = file => pathToFileURL(path.resolve('public/sao-original/Fonts', file)).href;
const html = `<!doctype html><style>@font-face{font-family:'SAO UI';src:url('${font('SAOUI-Regular.otf')}')}@font-face{font-family:'Source Han Sans';src:url('${font('SourceHanSans-Medium.otf')}')}html,body{margin:0;background:#000}</style><canvas width="${WIDTH}" height="${HEIGHT}"></canvas><script>${bundle.outputFiles[0].text}</script>`;
const harness = path.join(OUTPUT, 'harness.html');
await writeFile(harness, html);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.goto(pathToFileURL(harness).href);
  await page.evaluate(() => Promise.all([document.fonts.load("100px 'SAO UI'"), document.fonts.load("100px 'Source Han Sans'")]));
  for (const t of times) {
    const name = t.toFixed(3);
    await page.evaluate(([time]) => window.renderAt(time, { accountLength: 9, passwordLength: 3 }), [t]);
    const ours = path.join(OUTPUT, `ours-${name}.png`), reference = path.join(OUTPUT, `ref-${name}.png`);
    await page.locator('canvas').screenshot({ path: ours });
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(t), '-i', REFERENCE, '-frames:v', '1', reference]);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', reference, '-i', ours, '-filter_complex', `[0]scale=${PREVIEW_WIDTH}:-1[a];[1]scale=${PREVIEW_WIDTH}:-1[b];[a][b]hstack`, path.join(OUTPUT, `compare-${name}.png`)]);
  }
} finally { await browser.close(); }
console.log(`Compared ${times.length} frames in ${OUTPUT} (reference left, procedural right)`);
