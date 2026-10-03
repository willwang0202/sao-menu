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
  response.end(request.url === '/second' ? '<title>Second page</title><h1>Second page</h1>' : `<!doctype html><title>Browser verification</title><style>body{margin:32px;background:#fafafa;color:#555;font:20px sans-serif}button,input,a{display:block;margin:16px 0;padding:10px}h1{font-weight:400;color:#c88a24}</style><div style="position:absolute;left:700px;top:100px;width:100px;height:60px;background:rgb(230,40,70)"></div><h1>Browser verification</h1><button id="click" onclick="document.title='Clicked in curved browser';this.textContent='Click received'">Click through the curve</button><input id="text" placeholder="Type here"><a id="next" href="/second">Second page</a>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = `http://127.0.0.1:${server.address().port}/`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !['ELECTRON_RUN_AS_NODE', 'SAO_DEV_URL'].includes(key)));
let instance = await electron.launch({ executablePath: electronPath, args: ['.'], cwd: process.cwd(), env: { ...env, SAO_USER_DATA: temporary }, timeout: 30000 });
const errors = [];
try {
  const main = await instance.firstWindow();
    await main.waitForFunction(() => !!window.sao); await main.evaluate(() => window.sao.completeStartup());
  main.on('pageerror', error => errors.push(error.message));
  await main.getByRole('menuitem', { name: 'Kirito', exact: true }).waitFor();
  // Browser appearance retains cursor motion; freeze it only for coordinate tests.
  await main.evaluate(() => window.sao.openBrowser());
  const browser = instance.windows().find(page => page.url().includes('surface='));
  assert.ok(browser); browser.on('pageerror', error => errors.push(error.message));
  await browser.getByRole('region', { name: 'Built-in web browser' }).waitFor();
  await browser.evaluate(() => {
    window.testPagePixel = null;
    window.saoSurface.onFrame(frame => { const at=(130*frame.width+750)*4; window.testPagePixel=Array.from(frame.pixels.slice(at,at+4)); });
  });
  await browser.evaluate(url => window.saoSurface.navigate(url), address);
  await browser.waitForFunction(() => document.querySelector('.browser-title span')?.textContent === 'Browser verification');
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('surface=')).getTitle()), 'Browser verification');
  await browser.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.frames) > 1);
  await browser.waitForFunction(() => window.testPagePixel?.[0] === 70 && window.testPagePixel?.[1] === 40 && window.testPagePixel?.[2] === 230);
  await browser.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await browser.locator('canvas').evaluate(canvas => !!canvas.getContext('webgl2')), true, 'curved browser uses GPU rendering');
  await browser.addStyleTag({ content: '.floating-surface{transform:none!important}' });
  const bounds=await browser.locator('canvas').boundingBox(),inset=curveInset(750,1000,700);
  const pixel=await instance.evaluate(async ({BrowserWindow},point)=>{
    const view=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('surface='));
    const capture=await view.webContents.capturePage({x:Math.round(point.x),y:Math.round(point.y),width:1,height:1});
    return Array.from(capture.toBitmap().subarray(0,4));
  },{x:bounds.x+750/1000*bounds.width,y:bounds.y+(inset+168/700*(700-inset*2))/700*bounds.height});
  assert.ok(Math.abs(pixel[0]-70)<10 && Math.abs(pixel[1]-40)<10 && Math.abs(pixel[2]-230)<10 && pixel[3]===255,`actual curved-page pixel preserves BGRA channel order: ${JSON.stringify(pixel)}`);
  const rates = await instance.evaluate(({screen,webContents}) => {
    const original = screen.getDisplayMatching.bind(screen); screen.testOriginalMatching = original;
    screen.getDisplayMatching = bounds => ({...original(bounds),displayFrequency:120});
    screen.emit('display-metrics-changed', {}, screen.getPrimaryDisplay(), ['displayFrequency']);
    return webContents.getAllWebContents().filter(c => c.getType()==='offscreen').map(c => c.getFrameRate());
  });
  assert.deepEqual(rates,[120],'browser target updates to matching 120Hz display');
  await browser.evaluate(() => {window.testPointerFrames=0;window.saoSurface.onPointer(()=>window.testPointerFrames++);});
  await browser.waitForTimeout(1000);
  assert.ok(await browser.evaluate(()=>window.testPointerFrames)>=90,'native motion sampling follows 120Hz target');
  await instance.evaluate(({screen}) => {screen.getDisplayMatching=screen.testOriginalMatching;screen.emit('display-metrics-changed',{},screen.getPrimaryDisplay(),['displayFrequency']);});
  const motion = await browser.locator('.floating-surface').evaluate(element => element.style.transform);
  assert.ok(motion.includes('perspective'), 'native cursor updates reach the surface');
  await browser.addStyleTag({ content: '.floating-surface{transform:none!important}' });
  const remoteIsolation = await instance.evaluate(async ({ webContents }) => {
    const remote = webContents.getAllWebContents().find(contents => contents.getType() === 'offscreen');
    return remote.executeJavaScript('({node:typeof window.require, desktop:typeof window.sao, surface:typeof window.saoSurface})');
  });
  assert.deepEqual(remoteIsolation, { node: 'undefined', desktop: 'undefined', surface: 'undefined' });
  await browser.locator('canvas').click({ button: 'right', position: {x:200,y:200} });
  const fov = browser.getByRole('slider', {name:'Web preview field of view'});
  await fov.press('End');
  await browser.waitForFunction(() => document.querySelector('.browser-fov output')?.textContent === '100°');
  assert.equal((await browser.evaluate(() => window.saoSurface.getState())).fieldOfView,100);
  await browser.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const wideInset=curveInset(750,1000,700,100);
  const widePixel=await instance.evaluate(async ({BrowserWindow},point)=>{
    const view=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('surface='));
    const capture=await view.webContents.capturePage({x:Math.round(point.x),y:Math.round(point.y),width:1,height:1});
    return Array.from(capture.toBitmap().subarray(0,4));
  },{x:bounds.x+750/1000*bounds.width,y:bounds.y+(wideInset+168/700*(700-wideInset*2))/700*bounds.height});
  assert.ok(Math.abs(widePixel[0]-70)<10 && Math.abs(widePixel[1]-40)<10 && Math.abs(widePixel[2]-230)<10,`FOV changes the actual rendered curve: ${JSON.stringify(widePixel)}`);
  assert.equal(await browser.evaluate(async () => {try{await window.saoSurface.setFieldOfView(NaN);return false;}catch{return true;}}),true);
  const hit = async selector => {
    const native = await instance.evaluate(async ({ webContents }, selector) => {
      const remote = webContents.getAllWebContents().find(contents => contents.getType() === 'offscreen');
      return remote.executeJavaScript(`(()=>{const box=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:box.x+box.width/2,y:box.y+box.height/2}})()`);
    }, selector);
    const box = await browser.locator('canvas').boundingBox();
    const fieldOfView=(await browser.evaluate(() => window.saoSurface.getState())).fieldOfView;
    const inset = curveInset(native.x, 1000, 700, fieldOfView);
    await browser.mouse.click(box.x + native.x / 1000 * box.width, box.y + (inset + (native.y + 38) / 700 * (700 - inset * 2)) / 700 * box.height);
  };
  await hit('#click');
  await browser.waitForFunction(() => document.querySelector('.browser-title span')?.textContent === 'Clicked in curved browser');
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
  await browser.waitForFunction(() => document.querySelector('.browser-title span')?.textContent === 'Second page');
  assert.equal((await browser.evaluate(() => window.saoSurface.getState())).canGoBack, true);
  await browser.evaluate(() => window.saoSurface.command('back'));
  await browser.waitForFunction(() => document.querySelector('.browser-address-display')?.textContent?.endsWith('/'));
  await browser.evaluate(url => window.saoSurface.navigate(url), `${address}redirect`);
  await browser.waitForFunction(() => document.querySelector('.browser-title span')?.textContent === 'Second page');
  assert.equal(await browser.locator('.surface-error').count(), 0, 'superseded redirect loads do not cover a successful page with an error');
  await browser.evaluate(url => window.saoSurface.navigate(url), `${address}frame`);
  await browser.waitForFunction(() => document.querySelector('.browser-title span')?.textContent === 'Page with failed frame' && !!document.querySelector('[aria-label="Reload page"]'));
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
  await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).webContents.send('sao:pointer:down', { x: -30, y: -30 }));
  await main.waitForFunction(() => !document.querySelector('.original-menu'));
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).isVisible()), false);
  await instance.evaluate(({ app }) => app.emit('activate'));
  await main.locator('.original-menu').waitFor();
  await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).webContents.send('sao:menu:dismiss'));
  await main.waitForFunction(() => !document.querySelector('.original-menu'));
  assert.deepEqual(errors, []);
  await main.evaluate(() => window.sao.openBrowser());
  const savedBrowser=instance.windows().find(page=>page.url().includes('surface='));
  await savedBrowser.waitForFunction(()=>!!window.saoSurface);
  await savedBrowser.evaluate(async url=>{await window.saoSurface.navigate(url);await window.saoSurface.setFieldOfView(88);},address);
  await instance.close();
  const savedLayout=JSON.parse(await readFile(path.join(temporary,'surface-layout.json'),'utf8'));
  assert.equal(savedLayout.find(layout=>layout.kind==='browser').fieldOfView,88,'FOV saved on native exit');
  instance=await electron.launch({executablePath:electronPath,args:['.'],cwd:process.cwd(),env:{...env,SAO_USER_DATA:temporary},timeout:30000});
  const restartedMain=await instance.firstWindow();
  await restartedMain.waitForFunction(()=>!!window.sao);await restartedMain.evaluate(()=>window.sao.completeStartup());
  for(let attempt=0;attempt<100&&!instance.windows().some(page=>page.url().includes('surface='));attempt++)await new Promise(resolve=>setTimeout(resolve,100));
  const restoredBrowser=instance.windows().find(page=>page.url().includes('surface='));assert.ok(restoredBrowser);
  await restoredBrowser.getByRole('region',{name:'Built-in web browser'}).waitFor();
  assert.equal((await restoredBrowser.evaluate(()=>window.saoSurface.getState())).fieldOfView,88,'saved FOV restores after process restart');
  await restoredBrowser.locator('canvas').click({button:'right',position:{x:200,y:200}});
  await restoredBrowser.getByRole('menuitem',{name:'Reset field of view'}).click();
  await restoredBrowser.waitForFunction(()=>document.querySelector('.browser-fov output')?.textContent==='45°');
  await restoredBrowser.evaluate(()=>window.saoSurface.command('close'));
  console.log(JSON.stringify({ browser: 'native page painting, inverse curved click mapping, typed input, links/history, isolation and URL checks', media: 'simultaneous PNG, original GIF and looping WebM; pause/resume; replacement, token revocation and range streaming; previews survive menu dismissal', motion, dismissal: 'outside pointer and swipe channels animate and hide the native menu', screenshots: output }, null, 2));
} finally { await instance.close(); await new Promise(resolve => server.close(resolve)); await rm(temporary, { recursive: true, force: true }); }
