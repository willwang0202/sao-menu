import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, copyFile, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import electronPath from 'electron';
import { _electron as electron } from 'playwright';

const temporary = await mkdtemp(path.join(tmpdir(), 'sao-media-library-'));
const folder = path.join(temporary, 'Pictures'); await mkdir(folder);
await copyFile('public/sao-original/Images/etc/info.png', path.join(folder, '1.png'));
await copyFile('public/sao-original/Media/image-widget.png', path.join(folder, '2.png'));
await copyFile('public/sao-original/System/tutorial/launcher-1.gif', path.join(folder, 'ignore.gif'));
await writeFile(path.join(folder, 'ignore.svg'), '<svg/>');
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !['ELECTRON_RUN_AS_NODE', 'SAO_DEV_URL'].includes(key)));
const launch = () => electron.launch({ executablePath: electronPath, args: ['.'], cwd: process.cwd(), env: { ...env, SAO_USER_DATA: temporary }, timeout: 30000 });
let instance = await launch();
const errors = [];
try {
  let main = await instance.firstWindow();
  await main.waitForFunction(() => !!window.sao); await main.evaluate(() => window.sao.completeStartup());
  await main.getByRole('menuitem', { name: 'Kirito', exact: true }).waitFor();
  await instance.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, folder);
  await main.evaluate(() => window.sao.openGallery());
  let gallery = instance.windows().find(page => page.url().includes('surface=')); assert.ok(gallery);
  gallery.on('pageerror', error => errors.push(error.message));
  assert.equal(await gallery.getByRole('region', { name: 'Gallery preview' }).count(), 1, 'the folder opens as an original gallery, not a video');
  gallery.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
  await gallery.waitForFunction(() => document.querySelector('.gallery-canvas')?.dataset.status === 'ready' || document.querySelector('[role=alert]'));
  assert.equal(await gallery.evaluate(() => document.querySelector('[role=alert]')?.textContent ?? ''), '', 'the original transition draws without a graphics error');
  assert.deepEqual((await gallery.evaluate(() => window.saoSurface.getState())).gallery.images.map(image => image.title), ['1.png', '2.png']);
  await gallery.addStyleTag({ content: '.floating-surface{transform:none!important}' });
  await gallery.locator('.gallery-canvas').click();
  const pausedIndex = await gallery.locator('.gallery-canvas').getAttribute('data-image');
  await gallery.waitForTimeout(1200);
  assert.equal(await gallery.locator('.gallery-canvas').getAttribute('data-image'), pausedIndex, 'click pauses automatic slideshow');
  await gallery.locator('.gallery-canvas').hover(); await gallery.mouse.wheel(0, 100);
  await gallery.waitForFunction(index => document.querySelector('.gallery-canvas').dataset.image !== index, pausedIndex);
  const settings = (await gallery.evaluate(() => window.saoSurface.getState())).gallery.settings;
  const transitions = ['CircleCrop', 'Crosshatch', 'Cube', 'Directional', 'Fade', 'FadeColor', 'GridFlip', 'Hexagonalize', 'InvertedPageCurl', 'LinearBlur', 'LuminanceMelt', 'Pixelize', 'PolkaDotsCurtain', 'Radial', 'RandomSquares', 'SimpleZoom', 'SquaresWire', 'WindowSlice'];
  for (const transition of transitions) {
    await gallery.evaluate(settings => window.saoSurface.setGallery(settings), { ...settings, transition: `${transition}.glsl`, animateTime: 500, stillTime: 1000 });
    await gallery.waitForFunction(name => document.querySelector('.gallery-canvas')?.dataset.shader === name && document.querySelector('.gallery-canvas')?.dataset.status === 'ready', `${transition}.glsl`);
    assert.equal(await gallery.locator('[role=alert]').count(), 0, `${transition} compiles and draws`);
  }
  await gallery.evaluate(settings => window.saoSurface.setGallery(settings), { ...settings, transition: 'Fade.glsl', fill: 'contain', frame: 'compact-white.9.png', fillColor: '#e0e0e0', animateTime: 500 });
  await gallery.waitForFunction(() => document.querySelector('.gallery-canvas')?.dataset.shader === 'Fade.glsl');
  await gallery.screenshot({ path: path.resolve('output/playwright/current-gallery.png') });
  console.log('Gallery shaders and controls passed');
  const oldUrls = (await gallery.evaluate(() => window.saoSurface.getState())).gallery.images.map(image => image.url);
  await gallery.evaluate(() => window.saoSurface.command('refresh'));
  for (const url of oldUrls) assert.equal(await instance.evaluate(async ({ net }, url) => (await net.fetch(url)).status, url), 404);
  // Native disk-backed File objects follow the same preload path as Finder drops.
  const selectFiles = async (page, files) => {
    await page.evaluate(() => { const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.id = 'native-drop-fixture'; document.body.append(input); });
    await page.locator('#native-drop-fixture').setInputFiles(files);
    await page.evaluate(() => (window.saoSurface ?? window.sao).dropFiles([...document.querySelector('#native-drop-fixture').files]));
    await page.locator('#native-drop-fixture').evaluate(element => element.remove());
  };
  console.log('Gallery token refresh passed; testing native file drop');
  await selectFiles(main, [path.join(folder, '1.png')]);
  let image = instance.windows().find(page => page !== gallery && page.url().includes('surface=')); assert.ok(image);
  await image.waitForFunction(() => document.querySelector('.preview-image')?.naturalWidth > 0);
  const oldToken = (await image.evaluate(() => window.saoSurface.getState())).url;
  console.log('Media open passed; testing replacement');
  await selectFiles(image, [path.join(folder, '2.png')]);
  assert.equal((await image.evaluate(() => window.saoSurface.getState())).title, '2.png');
  assert.equal(await instance.evaluate(async ({ net }, url) => (await net.fetch(url)).status, oldToken), 404);
  assert.equal(await image.evaluate(async () => { try { await window.saoSurface.dropFiles([new File(['bad'], '/tmp/fake.png')]); return false; } catch { return true; } }), true, 'synthetic Files cannot supply a native path');
  await image.evaluate(() => window.saoSurface.setPresentation({ fill: 'cover', muted: true, autoResize: false }));
  await image.evaluate(async () => { await window.saoSurface.resize(480, 300); await window.saoSurface.move(-90, 35); });
  await image.waitForTimeout(450);
  const saved = JSON.parse(await readFile(path.join(temporary, 'surface-layout.json'), 'utf8'));
  const savedImage = saved.find(entry => entry.kind === 'image'); assert.ok(savedImage);
  console.log('Media drop and geometry passed; restarting native app');
  await instance.close(); instance = await launch(); main = await instance.firstWindow();
  await main.waitForFunction(() => !!window.sao); await main.evaluate(() => window.sao.completeStartup());
  await main.getByRole('menuitem', { name: 'Kirito', exact: true }).waitFor();
  await main.waitForTimeout(500);
  console.log('Restart passed; checking restored surfaces');
  const restored = instance.windows().filter(page => page.url().includes('surface='));
  assert.equal(restored.length, 2, 'gallery and preview restore without choosing files again');
  for (const page of restored) {
    const state = await page.evaluate(() => window.saoSurface.getState());
    if (state.kind === 'image') {
      await page.waitForFunction(() => document.querySelector('.preview-image')?.naturalWidth > 0);
      assert.deepEqual(state.presentation, { fill: 'cover', muted: true, autoResize: false });
      const bounds = await instance.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes(id)).getBounds(), state.id);
      assert.deepEqual(bounds, savedImage.bounds, 'restored native geometry is preserved after decoding');
    } else {
      assert.equal(state.gallery.settings.transition, 'Fade.glsl');
      await page.waitForFunction(() => document.querySelector('.gallery-canvas')?.dataset.status === 'ready');
    }
    const closed = page.waitForEvent('close'); await page.evaluate(() => window.saoSurface.command('close')); await closed;
  }
  await main.waitForTimeout(450);
  assert.deepEqual(JSON.parse(await readFile(path.join(temporary, 'surface-layout.json'), 'utf8')), [], 'explicitly closed surfaces stay closed');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ gallery: '18 original shader transitions; folder filtering, pause, wheel, settings, refresh and token revocation', drop: 'native disk-backed Files open and replace media; synthetic Files rejected', restore: 'sources, presentation and exact native geometry survive restart; explicit close removes entries' }, null, 2));
} finally { await instance.close(); await rm(temporary, { recursive: true, force: true }); }
