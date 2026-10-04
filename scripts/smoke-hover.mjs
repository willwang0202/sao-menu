import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import electronPath from 'electron';
import { _electron as electron } from 'playwright';

const temporary = await mkdtemp(path.join(tmpdir(), 'sao-hover-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !['ELECTRON_RUN_AS_NODE', 'SAO_DEV_URL'].includes(key)));
const instance = await electron.launch({ executablePath: electronPath, args: ['.'], cwd: process.cwd(), env: { ...env, SAO_USER_DATA: temporary } });
let releaseArtwork;
try {
  const page = await instance.firstWindow();
    await page.waitForFunction(() => !!window.sao); await page.evaluate(() => window.sao.completeStartup());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('menuitem', { name: 'Party', exact: true }).waitFor();
  await page.waitForLoadState('load');
  await instance.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html'));
    window.testPointer = { x: 2, y: 2 };
    screen.getCursorScreenPoint = () => { const bounds = window.getBounds(); return { x: window.testPointer.x + bounds.x, y: window.testPointer.y + bounds.y }; };
    // This test owns its pointer fixture; real user clicks in other apps must
    // not dismiss it while the independent hover stream is under test.
    const send = window.webContents.send.bind(window.webContents);
    window.webContents.send = (channel, ...args) => { if (!['sao:pointer:down', 'sao:menu:dismiss'].includes(channel)) send(channel, ...args); };
  });
  // Hold the white vector face through entrance and initial hover. This
  // proves that loading a hover face never blanks the already decoded icon.
  const artwork = new Promise(resolve => { releaseArtwork = resolve; });
  await page.route('**/sao-art/party-active.svg', async route => { await artwork; await route.continue(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await instance.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')); window.showInactive(); window.webContents.send('sao:menu:toggle', true, { x: 700, y: 350 }); });
  await page.getByRole('menuitem', { name: 'Party', exact: true }).waitFor();
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
  await page.evaluate(() => window.sao.onPointerMove(point => { window.testLatestPoint = point; }));
  await instance.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html'));
    window.hoverHistory = []; const original = window.setIgnoreMouseEvents.bind(window);
    window.setIgnoreMouseEvents = (enabled, options) => { window.hoverHistory.push(enabled); original(enabled, options); };
  });
  const pointAt = async button => {
    const bounds = await button.boundingBox();
    await instance.evaluate(({ BrowserWindow }, point) => { BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).testPointer = point; }, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
    await button.waitFor({ state: 'visible' });
    await page.waitForFunction(id => document.querySelector(`[data-hover-id="${id}"]`)?.classList.contains('hovered'), await button.getAttribute('data-hover-id'));
  };
  const visibleIcons = button => button.evaluate(element => [...element.querySelectorAll('img')].filter(image => getComputedStyle(image).opacity !== '0' && getComputedStyle(image).display !== 'none').map(image => ({ source: image.getAttribute('src'), loaded: image.complete && image.naturalWidth > 0 })));
  const button = page.getByRole('menuitem', { name: 'Party', exact: true });
  await pointAt(button);
  const cold = await visibleIcons(button);
  assert.deepEqual(cold, [{ source: './sao-art/party.svg', loaded: true }], 'cold hover retains decoded idle artwork');
  releaseArtwork();
  const waitHoverFace = async button => {
    const id = await button.getAttribute('data-hover-id');
    await page.waitForFunction(id => [...document.querySelector(`[data-hover-id="${id}"]`).querySelectorAll('img')].some(image => getComputedStyle(image).opacity === '1' && image.complete && /(?:-hovered\.png|-active\.svg)$/.test(image.getAttribute('src'))), id);
  };
  await waitHoverFace(button);
  const handoff = async button => {
    const samples = await button.evaluate(async element => {
      const states = [];
      for (let i = 0; i < 12; i++) {
        element.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.documentElement }));
        document.documentElement.dispatchEvent(new MouseEvent('mouseleave'));
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 2, clientY: 2 }));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const images = [...element.querySelectorAll('img')].filter(image => getComputedStyle(image).opacity !== '0');
        const background = getComputedStyle(element, ':before').backgroundImage;
        const point = window.testLatestPoint;
        const box = element.getBoundingClientRect();
        states.push({ sources: images.map(image => image.getAttribute('src')), hoveredBackground: background.includes('-hovered'), vectorRing: !!element.querySelector('.vector-ring'), hovered: element.classList.contains('hovered'), point, box: { x: box.x, y: box.y, width: box.width, height: box.height }, hit: point && document.elementFromPoint(point.x, point.y)?.outerHTML.slice(0, 160) });
      }
      return states;
    });
    assert.ok(samples.every(sample => sample.sources.length === 1 && /(?:-hovered\.png|-active\.svg)$/.test(sample.sources[0]) && (sample.hoveredBackground || sample.vectorRing)), `hover artwork and background stay stable during native handoffs: ${JSON.stringify(samples)}`);
  };
  await instance.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).hoverHistory = []; });
  await handoff(button);
  assert.deepEqual(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).hoverHistory), [], 'handoff never enables passthrough while the cursor is over a button');
  // No DOM movement/leave event is delivered here: the native cursor stream
  // must clear both faces and restore click-through by itself.
  await instance.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).testPointer = { x: 2, y: 2 }; });
  await page.waitForFunction(() => !document.querySelector('[data-root-index="1"]').classList.contains('hovered'));
  assert.deepEqual(await visibleIcons(button), [{ source: './sao-art/party.svg', loaded: true }]);
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).hoverHistory.at(-1)), true);
  const row = page.getByRole('menuitem', { name: 'Equipment', exact: true });
  await row.waitFor();
  // The original submenu enters 700ms after the rail and then slides for
  // another 600ms. Sample its final button position, not the passing rows.
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
  await pointAt(row); await waitHoverFace(row); await handoff(row);
  // Reducing animation must not turn off the pointer source used for hover.
  await page.evaluate(async () => { const settings = await window.sao.getSettings(); await window.sao.saveSettings({ ...settings, reducedMotion: true }); });
  await pointAt(button); await waitHoverFace(button); await handoff(button);
  await instance.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).testPointer = { x: 2, y: 2 }; });
  await page.waitForFunction(() => !document.querySelector('[data-root-index="1"]').classList.contains('hovered'));
  // Electron reports RGB here; rendered screenshot alpha verifies transparency.
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).getBackgroundColor()), '#000000');
  const background = await page.evaluate(() => [document.documentElement, document.body, document.querySelector('.sao-desktop')].map(element => ({ color: getComputedStyle(element).backgroundColor, backdrop: getComputedStyle(element).backdropFilter })));
  assert.ok(background.every(element => element.color === 'rgba(0, 0, 0, 0)' && element.backdrop === 'none'));
  await mkdir('output/playwright', { recursive: true });
  const screenshot = await page.screenshot({ path: path.resolve('output/playwright/current-transparent-menu.png'), omitBackground: true });
  const corner = await instance.evaluate(({ nativeImage }, bytes) => { const bitmap = nativeImage.createFromBuffer(Buffer.from(bytes)).toBitmap(); return bitmap[3]; }, [...screenshot]);
  assert.equal(corner, 0, 'outside-menu pixels remain fully transparent');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ hover: 'root and submenu sprite/background stay stable through 12 repeated native handoffs; native exit clears hover; Reduced Motion keeps hover active', loading: 'delayed hover sprite never blanks the decoded normal icon', transparency: 'no CSS backdrop filter and transparent screenshot pixels' }, null, 2));
} finally { releaseArtwork?.(); await instance.close(); await rm(temporary, { recursive: true, force: true }); }
