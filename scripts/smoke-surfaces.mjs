import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import electronPath from 'electron';
import { _electron as electron } from 'playwright';
import { curveInset } from '../src/shared/surfaces.ts';

const temporary = await mkdtemp(path.join(tmpdir(), 'sao-surface-smoke-'));
const output = path.resolve('output/playwright'); await mkdir(output, { recursive: true });
const server = createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  if (request.url === '/redirect') { response.end('<script>location.replace("/second")</script>'); return; }
  if (request.url === '/frame') { response.end('<title>Page with failed frame</title><iframe src="http://127.0.0.1:1/"></iframe>'); return; }
  response.end(request.url === '/second' ? '<title>Second page</title><h1>Second page</h1>' : `<!doctype html><title>Browser verification</title><style>body{margin:32px;background:#fafafa;color:#555;font:20px sans-serif}button,input,a{display:block;margin:16px 0;padding:10px}h1{font-weight:400;color:#c88a24}</style><h1>Browser verification</h1><button id="click" onclick="document.title='Clicked in curved browser';this.textContent='Click received'">Click through the curve</button><input id="text" placeholder="Type here"><a id="next" href="/second">Second page</a>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = `http://127.0.0.1:${server.address().port}/`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !['ELECTRON_RUN_AS_NODE', 'SAO_DEV_URL'].includes(key)));
const instance = await electron.launch({ executablePath: electronPath, args: ['.'], cwd: process.cwd(), env: { ...env, SAO_USER_DATA: temporary }, timeout: 30000 });
const errors = [];
try {
  const main = await instance.firstWindow();
  main.on('pageerror', error => errors.push(error.message));
  await main.getByRole('menuitem', { name: 'Kirito', exact: true }).waitFor();
  // Browser appearance retains cursor motion; freeze it only for coordinate tests.
  await main.evaluate(() => window.sao.openBrowser());
  const browser = instance.windows().find(page => page.url().includes('surface='));
  assert.ok(browser); browser.on('pageerror', error => errors.push(error.message));
  await browser.getByRole('region', { name: 'Built-in web browser' }).waitFor();
  await browser.evaluate(url => window.saoSurface.navigate(url), address);
  await browser.waitForFunction(async () => (await window.saoSurface.getState()).title === 'Browser verification');
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('surface=')).getTitle()), 'Browser verification');
  await browser.waitForFunction(() => document.querySelector('canvas').getContext('2d').getImageData(500, 320, 1, 1).data[3] === 255);
  const motion = await browser.locator('.floating-surface').evaluate(element => element.style.transform);
  assert.ok(motion.includes('perspective'), 'native cursor updates reach the surface');
  await browser.addStyleTag({ content: '.floating-surface{transform:none!important}' });
  const remoteIsolation = await instance.evaluate(async ({ webContents }) => {
    const remote = webContents.getAllWebContents().find(contents => contents.getType() === 'offscreen');
    return remote.executeJavaScript('({node:typeof window.require, desktop:typeof window.sao, surface:typeof window.saoSurface})');
  });
  assert.deepEqual(remoteIsolation, { node: 'undefined', desktop: 'undefined', surface: 'undefined' });
  const hit = async selector => {
    const native = await instance.evaluate(async ({ webContents }, selector) => {
      const remote = webContents.getAllWebContents().find(contents => contents.getType() === 'offscreen');
      return remote.executeJavaScript(`(()=>{const box=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:box.x+box.width/2,y:box.y+box.height/2}})()`);
    }, selector);
    const box = await browser.locator('canvas').boundingBox();
    const inset = curveInset(native.x, 1000, 700);
    await browser.mouse.click(box.x + native.x / 1000 * box.width, box.y + (inset + (native.y + 38) / 700 * (700 - inset * 2)) / 700 * box.height);
  };
  await hit('#click');
  await browser.waitForFunction(async () => (await window.saoSurface.getState()).title === 'Clicked in curved browser');
  await hit('#text'); await browser.keyboard.type('SAO browser');
  let typed = '';
  for (let attempt = 0; attempt < 30 && typed !== 'SAO browser'; attempt++) {
    typed = await instance.evaluate(async ({ webContents }) => webContents.getAllWebContents().find(contents => contents.getType() === 'offscreen').executeJavaScript('document.querySelector("#text").value'));
    if (typed !== 'SAO browser') await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(typed, 'SAO browser');
  // Allow the native paint/decode queue to catch up for the reference artifact.
  await browser.waitForTimeout(150);
  await browser.screenshot({ path: path.join(output, 'current-browser.png') });
  await hit('#next');
  await browser.waitForFunction(async () => (await window.saoSurface.getState()).title === 'Second page');
  assert.equal((await browser.evaluate(() => window.saoSurface.getState())).canGoBack, true);
  await browser.evaluate(() => window.saoSurface.command('back'));
  await browser.waitForFunction(async () => (await window.saoSurface.getState()).url.endsWith('/'));
  await browser.evaluate(url => window.saoSurface.navigate(url), `${address}redirect`);
  await browser.waitForFunction(async () => (await window.saoSurface.getState()).title === 'Second page');
  assert.equal(await browser.locator('.surface-error').count(), 0, 'superseded redirect loads do not cover a successful page with an error');
  await browser.evaluate(url => window.saoSurface.navigate(url), `${address}frame`);
  await browser.waitForFunction(async () => { const state = await window.saoSurface.getState(); return state.title === 'Page with failed frame' && !state.loading; });
  assert.equal(await browser.locator('.surface-error').count(), 0, 'a failed subframe does not cover the main page');
  for (const unsafe of ['file:///etc/passwd', 'javascript:alert(1)', 'https://me:secret@example.com']) {
    assert.equal(await browser.evaluate(async address => { try { await window.saoSurface.navigate(address); return false; } catch { return true; } }, unsafe), true);
  }
  assert.equal(await browser.evaluate(async () => { try { await window.saoSurface.input({ type: 'mouseDown', x: 90000, y: 0 }); return false; } catch { return true; } }), true);
  const browserClosed = browser.waitForEvent('close');
  await browser.evaluate(() => window.saoSurface.command('close'));
  await browserClosed;

  const png = path.join(temporary, 'Original artwork.png');
  const gif = path.join(temporary, 'Original animation.gif');
  const video = path.join(temporary, 'Video playback.webm');
  await copyFile('public/sao-original/Images/etc/info.png', png);
  await copyFile('public/sao-original/System/tutorial/launcher-1.gif', gif);
  await promisify(execFile)(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=10', '-t', '1', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', video]);
  await instance.evaluate(({ dialog }, paths) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths }); }, [png, gif, video]);
  await instance.evaluate(({ app }) => app.emit('activate'));
  await main.evaluate(() => window.sao.openMedia());
  const previews = instance.windows().filter(page => page.url().includes('surface='));
  assert.equal(previews.length, 3);
  const kinds = [];
  const previewByTitle = new Map();
  for (const page of previews) {
    page.on('pageerror', error => errors.push(error.message));
    const state = await page.evaluate(() => window.saoSurface.getState()); kinds.push(state.kind); previewByTitle.set(state.title, page);
    assert.ok(state.url.startsWith('sao-media://preview/'));
    if (state.kind === 'image') {
      await page.waitForFunction(() => document.querySelector('.preview-image')?.naturalWidth > 0);
      if (state.title.endsWith('.gif')) await page.screenshot({ path: path.join(output, 'current-image-preview.png') });
    } else {
      await page.waitForFunction(() => document.querySelector('video')?.currentTime > .1);
      assert.equal(await page.locator('video').evaluate(element => element.loop), true);
      await page.getByRole('button', { name: 'Pause video' }).click({ force: true });
      assert.equal(await page.locator('video').evaluate(element => element.paused), true);
      await page.getByRole('button', { name: 'Play video' }).click({ force: true });
      await page.waitForFunction(() => !document.querySelector('video').paused);
      await page.screenshot({ path: path.join(output, 'current-video-preview.png') });
    }
  }
  assert.deepEqual(kinds.sort(), ['image', 'image', 'video']);
  // Native chooser replacement revokes the old stream capability and supports
  // video-friendly byte ranges without exposing arbitrary file URLs.
  const originalImage = previewByTitle.get('Original artwork.png'); assert.ok(originalImage);
  const originalState = await originalImage.evaluate(() => window.saoSurface.getState());
  assert.equal(originalState.kind, 'image');
  await instance.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, gif);
  await originalImage.evaluate(() => window.saoSurface.command('change'));
  const replacement = await originalImage.evaluate(() => window.saoSurface.getState());
  assert.equal(replacement.title, 'Original animation.gif');
  assert.notEqual(replacement.url, originalState.url);
  assert.equal(await instance.evaluate(async ({ net }, url) => (await net.fetch(url)).status, originalState.url), 404);
  assert.deepEqual(await instance.evaluate(async ({ net }, url) => {
    const response = await net.fetch(url, { headers: { Range: 'bytes=0-9' } });
    return { status: response.status, length: (await response.arrayBuffer()).byteLength };
  }, replacement.url), { status: 206, length: 10 });
  const unsafe = path.join(temporary, 'Active document.svg'); await writeFile(unsafe, '<svg/>');
  await instance.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, unsafe);
  assert.equal(await originalImage.evaluate(async () => { try { await window.saoSurface.command('change'); return false; } catch { return true; } }), true);
  assert.equal((await originalImage.evaluate(() => window.saoSurface.getState())).url, replacement.url);
  const currentSettings = await main.evaluate(() => window.sao.getSettings());
  await main.evaluate(settings => window.sao.saveSettings({ ...settings, reducedMotion: true }), currentSettings);
  for (const page of previews) await page.waitForFunction(() => getComputedStyle(document.querySelector('.floating-surface')).transform === 'none');
  await main.evaluate(settings => window.sao.saveSettings(settings), currentSettings);
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(window => window.webContents.getURL().includes('surface=')).every(window => window.isVisible())), true, 'multiple previews stay visible after menu dismissal');
  await main.evaluate(() => window.sao.hide());
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(window => window.webContents.getURL().includes('surface=')).every(window => window.isVisible())), true);
  for (const page of previews) {
    const closed = page.waitForEvent('close');
    await page.evaluate(() => window.saoSurface.command('close'));
    await closed;
  }
  // Outside native clicks and upward dismiss gestures reach the original exit transition.
  await instance.evaluate(({ app }) => app.emit('activate'));
  await main.locator('.original-menu').waitFor();
  await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('sao:pointer:down', { x: -30, y: -30 }));
  await main.waitForFunction(() => !document.querySelector('.original-menu'));
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
  await instance.evaluate(({ app }) => app.emit('activate'));
  await main.locator('.original-menu').waitFor();
  await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('sao:menu:dismiss'));
  await main.waitForFunction(() => !document.querySelector('.original-menu'));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ browser: 'native page painting, inverse curved click mapping, typed input, links/history, isolation and URL checks', media: 'simultaneous PNG, original GIF and looping WebM; pause/resume; replacement, token revocation and range streaming; previews survive menu dismissal', motion, dismissal: 'outside pointer and swipe channels animate and hide the native menu', screenshots: output }, null, 2));
} finally { await instance.close(); await new Promise(resolve => server.close(resolve)); await rm(temporary, { recursive: true, force: true }); }
