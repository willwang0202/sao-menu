import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import electronPath from 'electron';
import { _electron as electron } from 'playwright';

// Chromium's synthetic camera exercises the real camera → MediaPipe → IPC path
// without touching the physical webcam or the macOS camera prompt.
const STARTUP_TIMEOUT_MS = 45_000;
const POLL_MS = 250;
const userData = await mkdtemp(path.join(tmpdir(), 'sao-hand-smoke-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !['ELECTRON_RUN_AS_NODE', 'SAO_DEV_URL'].includes(key)));
const instance = await electron.launch({
  executablePath: electronPath, args: ['.', '--use-fake-device-for-media-stream'], cwd: process.cwd(),
  env: { ...env, SAO_USER_DATA: userData }, timeout: 30_000,
});
const errors = [];

async function waitForStatus(page, predicate, label) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let status;
  while (Date.now() < deadline) {
    status = await page.evaluate(() => window.sao.getHandTrackingStatus());
    if (predicate(status)) return status;
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(status)}`);
}

try {
  const page = await instance.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  // Skip the Link Start intro, as the desktop smoke test does.
  await page.waitForFunction(() => !!window.sao); await page.evaluate(() => window.sao.completeStartup());
  await page.getByRole('menuitem', { name: 'Kirito', exact: true }).waitFor();
  await instance.evaluate(({ systemPreferences }) => { systemPreferences.getMediaAccessStatus = () => 'granted'; });

  const off = await page.evaluate(() => window.sao.getHandTrackingStatus());
  assert.equal(off.enabled, false, 'hand tracking is off by default');
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.getTitle() === 'SAO Hand Tracker')), false, 'no tracker window while off');

  const settings = await page.evaluate(() => window.sao.getSettings());
  await page.evaluate(next => window.sao.saveSettings(next), { ...settings, handTracking: true });
  const running = await waitForStatus(page, status => status.running || /could not|denied|No camera/.test(status.message), 'tracker running');
  assert.equal(running.running, true, running.message);

  const tracker = await instance.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(candidate => candidate.getTitle() === 'SAO Hand Tracker');
    const preferences = window?.webContents.getLastWebPreferences();
    return window && { visible: window.isVisible(), sandbox: preferences.sandbox, isolation: preferences.contextIsolation, node: preferences.nodeIntegration };
  });
  assert.deepEqual(tracker, { visible: false, sandbox: true, isolation: true, node: false });

  const overlayCamera = await page.evaluate(() => navigator.mediaDevices.getUserMedia({ video: true }).then(stream => { stream.getTracks().forEach(track => track.stop()); return 'granted'; }, error => error.name));
  assert.equal(overlayCamera, 'NotAllowedError', 'the launcher renderer cannot open the camera');

  // Drive the overlay half of the pipeline with a synthetic hand cursor and push-click.
  const target = await page.locator('.root-button').nth(1).boundingBox();
  const centre = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  await instance.evaluate(({ BrowserWindow }, point) => {
    BrowserWindow.getAllWindows().find(window => window.getTitle() === 'SAO Utils 2').webContents.send('sao:hand:cursor', { ...point, visible: true });
  }, centre);
  await page.locator('.hand-reticle').waitFor();
  await page.waitForFunction(() => document.querySelector('.root-button.hovered') !== null);
  const label = await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.closest('button')?.getAttribute('aria-label'), centre);
  const received = page.evaluate(point => new Promise(resolve => {
    const button = document.elementFromPoint(point.x, point.y)?.closest('button');
    button?.addEventListener('click', () => resolve(button.getAttribute('aria-label')), { once: true });
    setTimeout(() => resolve(null), 2000);
  }), centre);
  await instance.evaluate(({ BrowserWindow }, point) => {
    BrowserWindow.getAllWindows().find(window => window.getTitle() === 'SAO Utils 2').webContents.send('sao:hand:click', point);
  }, centre);
  assert.equal(await received, label, 'push-click activates the control under the reticle');

  // The debug view shows live and closing it only turns the setting off; tracking keeps running.
  const trackerVisible = () => instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.getTitle() === 'SAO Hand Tracker')?.isVisible() ?? null);
  await page.evaluate(next => window.sao.saveSettings(next), { ...settings, handTracking: true, handDebugView: true });
  assert.equal(await trackerVisible(), true, 'debug view shown');
  await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.getTitle() === 'SAO Hand Tracker').close());
  await page.waitForFunction(async () => !(await window.sao.getSettings()).handDebugView);
  assert.equal(await trackerVisible(), false, 'closing the debug view hides it');
  assert.equal((await page.evaluate(() => window.sao.getHandTrackingStatus())).running, true, 'tracking survives closing the debug view');

  await page.evaluate(next => window.sao.saveSettings(next), { ...settings, handTracking: false });
  const stopped = await page.evaluate(() => window.sao.getHandTrackingStatus());
  assert.deepEqual([stopped.enabled, stopped.running], [false, false]);
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.getTitle() === 'SAO Hand Tracker')), false, 'camera window closed');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ handSmoke: 'passed', delegateStatus: running.message }));
} finally {
  await instance.close();
  await rm(userData, { recursive: true, force: true });
}
