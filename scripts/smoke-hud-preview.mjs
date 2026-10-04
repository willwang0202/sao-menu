import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
const profile = await mkdtemp(path.join(tmpdir(), 'sao-hud-preview-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'ELECTRON_RUN_AS_NODE'));
const instance = await electron.launch({ args: ['.'], env: { ...env, SAO_USER_DATA: profile }, timeout: 60000 });
const loadedWindow = async fragment => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const page = instance.windows().find(page => page.url().includes(fragment));
    if (page) return page;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Window did not load: ${fragment}`);
};
try {
  const main = await instance.firstWindow(); await main.waitForFunction(() => !!window.sao);
  await main.evaluate(() => window.sao.completeStartup());
  const seed = { playerName: 'willwang22', accountCreatedAt: Date.now() - 2 * 86400000, reducedMotion: true, stats: { batteryPercent: 43 }, partyMembers: [{ id: 'companion', displayName: 'Long party member name 测试名字', online: true, batteryPercent: 67 }] };
  await instance.evaluate(({ BrowserWindow }, seed) => {
    const window = BrowserWindow.getAllWindows().find(window => window.getTitle() === 'SAO HP Display');
    const send = window.webContents.send.bind(window.webContents);
    window.webContents.send = (channel, ...args) => send(channel, ...(channel === 'sao:hp:update' ? [seed] : args));
    window.setSize(window.getSize()[0], 89);
    window.webContents.send('sao:hp:update', seed); window.showInactive();
  }, seed);
  const hud = await loadedWindow('hp=1');
  await hud.evaluate(() => document.fonts.ready);
  await hud.waitForFunction(() => document.querySelector('.hp-name-text')?.textContent === 'willwang22' && innerWidth > 358 && innerWidth === document.querySelector('.hp-display').getBoundingClientRect().width);
  const measurements = await hud.evaluate(() => {
    const own = document.querySelector('.hp-name'), extra = document.querySelector('.hp-extra-name');
    return { name: own.textContent, nameWidth: own.getBoundingClientRect().width, textWidth: own.querySelector('span').getBoundingClientRect().width,
      partyWidth: extra.getBoundingClientRect().width, partyTextWidth: extra.querySelector('span').getBoundingClientRect().width, level: document.querySelector('.hp-level').textContent,
      ownBarWidth: document.querySelector('.hp-main-mask').getBoundingClientRect().width, nativeWidth: innerWidth, contentWidth: document.querySelector('.hp-display').getBoundingClientRect().width };
  });
  assert.equal(measurements.level, 'LV: 3'); assert.ok(measurements.nameWidth > 40);
  assert.ok(measurements.nameWidth >= measurements.textWidth + 7); assert.ok(measurements.partyWidth >= measurements.partyTextWidth + 7);
  assert.equal(measurements.ownBarWidth, 258); assert.equal(measurements.nativeWidth, measurements.contentWidth);
  await mkdir('output/playwright', { recursive: true });
  await instance.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(window => window.getTitle() === 'SAO HP Display');
    window.showInactive(); window.setFocusable(true); window.focus();
  });
  await hud.screenshot({ path: 'output/playwright/hp-long-name.png', timeout: 10000 });
  await main.evaluate(() => window.sao.openBrowser());
  const browser = await loadedWindow('surface=');
  await browser.getByRole('region', { name: 'Built-in web browser' }).waitFor();
  const geometry = await instance.evaluate(({ BrowserWindow, screen }, url) => {
    const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === url);
    return { bounds: window.getBounds(), area: screen.getDisplayMatching(window.getBounds()).workArea };
  }, browser.url());
  assert.equal(geometry.bounds.width, Math.round(geometry.area.width * .9)); assert.equal(geometry.bounds.height, Math.round(geometry.area.height * .9));
  assert.equal((await browser.evaluate(() => window.saoSurface.getState())).fieldOfView, 20);
  const handle = browser.getByRole('button', { name: 'Resize preview', exact: true });
  await handle.focus(); await handle.press('ArrowLeft');
  await browser.waitForFunction(width => innerWidth === width, geometry.bounds.width - 32);
  await browser.getByLabel('Preview field of view').fill('32');
  assert.equal((await browser.evaluate(() => window.saoSurface.getState())).fieldOfView, 32);
  const report = { measuredNames: measurements, preview: { defaultFov: 20, initialBounds: geometry.bounds, cornerResize: true, adjustableFov: true }, verifiedAt: new Date().toISOString() };
  await writeFile('output/hud-preview-acceptance.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} finally {
  const timer = setTimeout(() => instance.process().kill('SIGKILL'), 10000);
  try { await instance.close(); } finally { clearTimeout(timer); await rm(profile, { recursive: true, force: true }); }
}
