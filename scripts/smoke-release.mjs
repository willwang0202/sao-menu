// Launch the packaged binary with an empty profile; no real webcam or public account is used.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const executablePath = path.resolve(process.platform === 'darwin'
  ? `release/${process.arch === 'arm64' ? 'mac-arm64' : 'mac'}/SAO Utils 2.app/Contents/MacOS/SAO Utils 2`
  : process.platform === 'win32' ? 'release/win-unpacked/SAO Utils 2.exe' : 'release/linux-unpacked/sao-menu');
const userData = await mkdtemp(path.join(tmpdir(), 'sao-release-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['ELECTRON_RUN_AS_NODE', 'SAO_DEV_URL'].includes(key)));
const instance = await electron.launch({ executablePath, args: [`--sao-profile=${userData}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], env, timeout: 60_000 });
try {
  assert.equal(await instance.evaluate(({ app }) => app.getPath('userData')), userData, 'The packaged check must use its disposable profile');
  const page = await instance.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => !!window.sao);
  const runtime = await page.evaluate(() => window.sao.getRuntime());
  assert.equal(runtime.desktop, true);
  assert.equal(runtime.version, pkg.version);
  assert.equal(runtime.platform, process.platform);
  assert.equal((await page.evaluate(() => window.sao.getSettings())).handTracking, false);
  const update = await page.evaluate(() => window.sao.getUpdateStatus());
  assert.equal(update.currentVersion, pkg.version); assert.notEqual(update.capability, 'unavailable');
  assert.equal((await page.evaluate(() => window.sao.getSettings())).automaticUpdates, true);
  await assert.rejects(page.evaluate(() => window.sao.installUpdate()), /Download and verify/);
  assert.equal((await page.evaluate(() => window.saoSocial.getState())).serviceURL, 'https://sao-menu.favioon.com');
  await page.getByRole('button', { name: 'Skip intro', exact: true }).click();
  await page.getByRole('form', { name: 'SAO account login', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Account service', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('form', { name: 'Create SAO account', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Display name', { exact: true }).count(), 1);
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.getTitle() === 'SAO HP Display').isVisible()), false);
  await page.evaluate(() => window.sao.completeStartup());
  await page.getByRole('menuitem', { name: 'Kirito', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(async () => (await document.fonts.load('500 15px "SAO UI"')).length), 1);
  const isolation = await page.evaluate(() => ({ node: typeof window.require, process: typeof window.process }));
  assert.deepEqual(isolation, { node: 'undefined', process: 'undefined' });
  assert.deepEqual(errors, []);
  console.log(`Packaged ${process.platform}/${process.arch} v${pkg.version} launched: menu, original font, hosted service and camera-off defaults passed.`);
} finally {
  await instance.close();
  await rm(userData, { recursive: true, force: true });
}
