// Real launch-screen registration and account/battery UI, using a disposable local service.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import electronPath from 'electron';
import { _electron as electron } from 'playwright';
import { createSocialService } from '../src/service/accounts.ts';
import { accountHTTPServer } from '../src/service/http.ts';
const profile = await mkdtemp(path.join(tmpdir(), 'sao-account-hud-'));
const service = createSocialService(path.join(profile, 'accounts.sqlite'));
const server = accountHTTPServer(service);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
await writeFile(path.join(profile, 'settings.json'), JSON.stringify({ version: 1, playerName: 'Old local name', reducedMotion: true, sound: false, favorites: [] }));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['ELECTRON_RUN_AS_NODE', 'SAO_DEV_URL'].includes(key)));
const instance = await electron.launch({ executablePath: electronPath, args: ['.'], cwd: process.cwd(), env: { ...env, SAO_USER_DATA: profile, SAO_TEST_SERVICE_URL: `http://127.0.0.1:${server.address().port}` } });
try {
  const page = await instance.firstWindow();
  await page.getByRole('form', { name: 'SAO account login', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Account service', exact: true }).count(), 0);
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.getTitle() === 'SAO HP Display').isVisible()), false);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Account', { exact: true }).fill('actual_player');
  await page.getByLabel('Password', { exact: true }).fill('a real signup test password');
  await page.getByLabel('Display name', { exact: true }).fill('Actual display name');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Actual display name', exact: true }).waitFor();
  const hud = instance.windows().find(page => page.url().includes('hp=1'));
  await hud.waitForFunction(() => document.querySelector('.hp-name')?.textContent === 'Actual display name');
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.getTitle() === 'SAO HP Display').isVisible()), true);
  const stats = await hud.evaluate(() => window.saoHP.getState());
  assert.equal(await hud.locator('.hp-main').getAttribute('data-battery-percent'), String(stats.stats?.batteryPercent ?? 100));
  assert.equal(await hud.locator('.hp-extra').count(), 0);
  assert.equal((await page.evaluate(() => window.saoSocial.getState())).snapshot.profile.displayName, 'Actual display name');
  console.log('PASS: launch-screen signup creates a real account; menu/HUD use its display name, battery telemetry and solo gating; HP stays hidden before login.');
} finally {
  await instance.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); await rm(profile, { recursive: true, force: true });
}
