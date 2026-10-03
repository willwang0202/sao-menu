import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import electronPath from 'electron';
import { _electron as electron } from 'playwright';

const temporary = await mkdtemp(path.join(tmpdir(), 'sao-startup-recovery-'));
const server = createServer((request, response) => {
  response.writeHead(request.url === '/v1/login' ? 200 : 401, { 'content-type': 'application/json' });
  response.end(JSON.stringify(request.url === '/v1/login' ? { token: 'a'.repeat(43) } : { error: 'Session validation rejected.' }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = `http://127.0.0.1:${server.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !['ELECTRON_RUN_AS_NODE', 'SAO_DEV_URL'].includes(key)));
const instance = await electron.launch({ executablePath: electronPath, args: ['.'], cwd: process.cwd(), env: { ...env, SAO_USER_DATA: temporary } });
const failures = [];
try {
  const page = await instance.firstWindow();
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await page.getByRole('form', { name: 'SAO account login' }).waitFor();
  await page.getByRole('button', { name: 'Account service', exact: true }).click();
  const cdp = await page.context().newCDPSession(page);
  for (const viewport of [{ width: 5120, height: 1440 }, { width: 900, height: 1600 }]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: false });
    const clipped = await page.locator('.startup-login-scene input,.startup-login-scene button').evaluateAll(elements => elements.flatMap(element => {
      const r = element.getBoundingClientRect();
      return r.x < 0 || r.y < 0 || r.right > innerWidth || r.bottom > innerHeight ? [element.getAttribute('aria-label') || element.textContent || element.className] : [];
    }));
    if (clipped.length) failures.push(`${viewport.width}×${viewport.height} clips functional controls: ${clipped.join(', ')}`);
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await page.getByLabel('Startup account service').fill(address);
  await page.getByLabel('Account', { exact: true }).fill('kirito');
  await page.getByLabel('Password', { exact: true }).fill('a rejected session password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  let state;
  for (let attempt = 0; attempt < 100; attempt++) {
    state = await page.evaluate(() => window.saoSocial.getState());
    if (state.error) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(state.error, 'Session validation rejected.');
  assert.equal(state.snapshot, null);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const phase = await page.locator('.link-start').getAttribute('data-phase');
  if (phase !== 'login') failures.push(`Rejected session incorrectly advanced to ${phase}`);
  const error = await page.getByRole('alert').allTextContents();
  if (!error.some(text => text.includes('Session validation rejected.'))) failures.push('Session validation failure is not shown to the user');
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.getTitle() === 'SAO HP Display').isVisible()), false);
  assert.deepEqual(failures, []);
  await page.getByRole('button', { name: 'Continue offline', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Kirito', exact: true }).waitFor();
  console.log('PASS: ultrawide/portrait login controls stay in view; rejected session preserves login and shows its error; offline continuation remains available.');
} finally {
  await instance.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
