// Exercise the real packaged Mac updater against a loopback fixture, using a
// disposable profile. The fixture alters the transport's reported current version
// only inside this test process; production has no feed/version override switch.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { _electron as electron } from 'playwright';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const installer = `sao-menu-${pkg.version}-mac-arm64.zip`, file = path.resolve('release', installer);
const bytes = await readFile(file), sha512 = createHash('sha512').update(bytes).digest('base64');
let corrupt = false, fileRequests = 0;
const server = createServer((request, response) => {
  if (request.url?.startsWith('/latest-mac.yml')) {
    response.setHeader('Content-Type', 'text/yaml'); response.end(JSON.stringify({ version: pkg.version, files: [{ url: installer, size: bytes.length, sha512: corrupt ? Buffer.alloc(64, 1).toString('base64') : sha512 }], path: installer, sha512 }));
  } else if (request.url?.split('?')[0] === `/${installer}`) {
    fileRequests++; response.setHeader('Content-Length', bytes.length); createReadStream(file).pipe(response);
  } else { response.statusCode = 404; response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(path.join(tmpdir(), 'sao-update-smoke-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['ELECTRON_RUN_AS_NODE', 'SAO_DEV_URL'].includes(key)));
let instance;
try {
  instance = await electron.launch({ executablePath: path.resolve('release/mac-universal/SAO Menu.app/Contents/MacOS/SAO Menu'), args: [`--sao-profile=${profile}`], env, timeout: 60000 });
  console.log('Packaged updater launched');
  const page = await instance.firstWindow(); page.setDefaultTimeout(15000); await page.waitForFunction(() => !!window.sao);
  assert.equal((await page.evaluate(() => window.sao.getUpdateStatus())).capability, 'automatic');
  await page.evaluate(() => window.sao.completeStartup());
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Option', exact: true }).click();
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Automatically check and download updates' }).uncheck();
  await page.waitForFunction(async () => !(await window.sao.getSettings()).automaticUpdates);
  await instance.evaluate(async ({ app }, url) => {
    const require = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`);
    const module = require('electron-updater');
    module.autoUpdater.setFeedURL({ provider: 'generic', url });
  }, address);
  assert.equal((await page.evaluate(() => window.sao.checkForUpdates())).status, 'current');
  assert.equal(fileRequests, 0); console.log('Current-version check passed');
  await instance.evaluate(async ({ app }) => {
    const require = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`);
    const module = require('electron-updater');
    const updater = module.autoUpdater;
    const version = updater.currentVersion;
    updater.currentVersion = new version.constructor('0.0.1');
  });
  corrupt = true;
  assert.equal((await page.evaluate(() => window.sao.checkForUpdates())).status, 'available');
  assert.equal((await page.evaluate(() => window.sao.downloadUpdate())).status, 'error', 'sha512 failure must never become installable');
  await assert.rejects(page.evaluate(() => window.sao.installUpdate()), /Download and verify/);
  console.log('Invalid checksum rejected');
  corrupt = false;
  assert.equal((await page.evaluate(() => window.sao.checkForUpdates())).status, 'available');
  const downloaded = await page.evaluate(() => window.sao.downloadUpdate());
  assert.equal(downloaded.status, 'downloaded'); assert.equal(downloaded.percent, 100); console.log('Verified retry downloaded');
  await page.getByRole('button', { name: 'Install and restart', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Install and restart', exact: true }).isEnabled(), true);
  assert.equal(await page.getByRole('checkbox', { name: 'Automatically check and download updates' }).isChecked(), false);
  await mkdir('output/playwright', { recursive: true });
  await instance.evaluate(({ app }) => app.emit('activate'));
  await page.screenshot({ path: 'output/playwright/updates-ready.png', timeout: 10000 });
  console.log('Update controls passed');
  // Simulate slow/failing native preparation after a real verified download.
  // Never call the actual OS installer from this acceptance check.
  await instance.evaluate(({ autoUpdater }) => { autoUpdater.checkForUpdates = () => {}; });
  const installing = page.evaluate(async () => { try { await window.sao.installUpdate(); return ''; } catch (error) { return String(error); } });
  await page.waitForFunction(async () => (await window.sao.getUpdateStatus()).status === 'installing');
  await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).close());
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.webContents.getURL().endsWith('/index.html'))), true, 'close during staging must hide, not destroy, the launcher');
  await page.evaluate(async () => { const settings = await window.sao.getSettings(); await window.sao.saveSettings({ ...settings, reducedMotion: true }); });
  await instance.evaluate(({ autoUpdater }) => autoUpdater.emit('error', new Error('Native staging fixture failure')));
  assert.match(await installing, /Native staging fixture failure/);
  assert.equal((await page.evaluate(() => window.sao.getUpdateStatus())).status, 'downloaded');
  assert.equal(JSON.parse(await readFile(path.join(profile, 'settings.json'), 'utf8')).reducedMotion, true, 'configuration saved during staging is retained');
  await instance.evaluate(({ app }) => app.emit('activate'));
  const report = { version: pkg.version, fixtureCurrentCheck: true, checksumRejection: true, retryDownload: true, installButton: true, automaticSettingPersisted: true, profileIsolated: true, deferredNativeStageKeepsWindowAlive: true, nativeStagingFailureRetainsDownload: true, stagingEditsPersist: true, fileRequests, verifiedAt: new Date().toISOString() };
  await writeFile('output/update-acceptance.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  if (instance) {
    const timer = setTimeout(() => instance.process().kill('SIGKILL'), 10000);
    try { await instance.close(); } finally { clearTimeout(timer); }
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(profile, { recursive: true, force: true });
}
