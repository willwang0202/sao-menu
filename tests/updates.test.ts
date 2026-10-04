import { EventEmitter } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';
import { UpdateController, updateCapability } from '../src/desktop/updates';

class Transport extends EventEmitter {
  autoDownload = true; autoInstallOnAppQuit = true;
  checks = 0; downloads = 0; installs = 0;
  version = '0.1.8'; fail = false;
  async checkForUpdates() {
    this.checks++;
    await Promise.resolve();
    if (this.fail) throw new Error('offline');
    this.emit(this.version === '0.1.7' ? 'update-not-available' : 'update-available', { version: this.version });
    return {};
  }
  async downloadUpdate() { this.downloads++; }
  quitAndInstall() { this.installs++; }
}
function setup(automatic = true, beforeInstall = async () => {}) {
  const updater = new Transport();
  const controller = new UpdateController({ currentVersion: '0.1.7', capability: 'automatic', automatic, updater, beforeInstall });
  return { updater, controller };
}

test('only supported installed packages offer automatic installation', () => {
  assert.equal(updateCapability({ packaged: false, platform: 'darwin', signedMac: true }), 'unavailable');
  assert.equal(updateCapability({ packaged: true, platform: 'darwin', signedMac: true }), 'automatic');
  assert.equal(updateCapability({ packaged: true, platform: 'darwin' }), 'manual');
  assert.equal(updateCapability({ packaged: true, platform: 'win32', installedWindows: true }), 'automatic');
  assert.equal(updateCapability({ packaged: true, platform: 'win32' }), 'manual');
  assert.equal(updateCapability({ packaged: true, platform: 'linux', appImage: true }), 'automatic');
  assert.equal(updateCapability({ packaged: true, platform: 'linux' }), 'manual');
});
test('development checks stay disabled without contacting a release service', async () => {
  let calls = 0;
  const controller = new UpdateController({ currentVersion: '0.1.7', capability: 'unavailable', automatic: true, latestRelease: async () => { calls++; return '0.1.8'; } });
  assert.equal((await controller.check()).status, 'disabled'); assert.equal(calls, 0);
});
test('automatic checks coalesce and download a newer version once', async () => {
  const { updater, controller } = setup();
  await Promise.all([controller.check(), controller.check()]);
  assert.equal(updater.checks, 1); assert.equal(updater.downloads, 1);
  assert.equal(controller.getState().status, 'downloading');
  assert.equal(updater.autoDownload, false); assert.equal(updater.autoInstallOnAppQuit, false);
  await controller.check(); assert.equal(updater.checks, 1, 'a pending download survives another check');
  updater.emit('download-progress', { percent: 52.25 });
  assert.equal(controller.getState().percent, 52.25);
  updater.emit('update-downloaded', { version: '0.1.8' });
  assert.equal(controller.getState().status, 'downloaded'); assert.equal(updater.installs, 0);
});
test('manual checks leave downloads for the user and downloads coalesce', async () => {
  const { updater, controller } = setup(false);
  assert.equal((await controller.check()).status, 'available'); assert.equal(updater.downloads, 0);
  await Promise.all([controller.download(), controller.download()]); assert.equal(updater.downloads, 1);
});
test('turning automatic updates off while a check is pending prevents its download', async () => {
  const { updater, controller } = setup();
  const check = controller.check(); controller.setAutomatic(false); await check;
  assert.equal(updater.downloads, 0); assert.equal(controller.getState().status, 'available');
});
test('check errors can be retried and a current version never downloads', async () => {
  const { updater, controller } = setup();
  updater.fail = true; assert.equal((await controller.check()).status, 'error');
  updater.fail = false; updater.version = '0.1.7';
  const state = await controller.check(); assert.equal(state.status, 'current'); assert.ok(state.checkedAt);
  assert.equal(updater.downloads, 0); assert.equal(state.latestVersion, '0.1.7');
});
test('install is gated on a verified download and flushes before installing once', async () => {
  let release!: () => void; const flushed = new Promise<void>(resolve => { release = resolve; });
  const { updater, controller } = setup(false, () => flushed);
  await assert.rejects(controller.install(), /download/i);
  await controller.check(); await controller.download(); updater.emit('update-downloaded', { version: '0.1.8' });
  const first = controller.install(), second = controller.install();
  assert.equal(updater.installs, 0); release(); await Promise.all([first, second]);
  assert.equal(updater.installs, 1); assert.equal(controller.getState().status, 'installing');
});
test('a failed layout flush leaves the app running and allows installation retry', async () => {
  let fail = true;
  const { updater, controller } = setup(false, async () => { if (fail) throw new Error('disk full'); });
  await controller.check(); await controller.download(); updater.emit('update-downloaded', { version: '0.1.8' });
  await assert.rejects(controller.install(), /disk full/); assert.equal(updater.installs, 0);
  assert.equal(controller.getState().status, 'downloaded');
  fail = false; await controller.install(); assert.equal(updater.installs, 1);
});
test('download failures report an error and allow another check', async () => {
  const { updater, controller } = setup();
  updater.downloadUpdate = async () => { throw new Error('checksum mismatch'); };
  assert.equal((await controller.check()).status, 'error');
  updater.downloadUpdate = async () => { updater.downloads++; };
  await controller.check(); assert.equal(updater.downloads, 1);
  controller.dispose(); updater.emit('download-progress', { percent: 99 });
  assert.equal(controller.getState().percent, 0);
});
test('manual-only packages compare stable versions and never offer an in-app installer', async () => {
  let version = '0.1.8';
  const controller = new UpdateController({ currentVersion: '0.1.7', capability: 'manual', automatic: false, latestRelease: async () => version });
  assert.equal((await controller.check()).status, 'available');
  await assert.rejects(controller.download(), /installer/i);
  version = '0.1.6'; assert.equal((await controller.check()).status, 'current');
  version = '0.1.9-beta.1'; assert.equal((await controller.check()).status, 'error');
});

test('native preparation can stay asynchronous without installing or flushing early', async () => {
  let ready!: () => void, flushes = 0;
  const preparation = new Promise<void>(resolve => { ready = resolve; });
  const updater = new Transport();
  const controller = new UpdateController({ currentVersion: '0.1.7', capability: 'automatic', automatic: false, updater,
    prepareInstall: () => preparation, beforeInstall: async () => { flushes++; } });
  await controller.check(); await controller.download(); updater.emit('update-downloaded', { version: '0.1.8' });
  const install = controller.install(); await Promise.resolve();
  assert.equal(flushes, 0); assert.equal(updater.installs, 0); assert.equal(controller.getState().status, 'installing');
  ready(); await install; assert.equal(flushes, 1); assert.equal(updater.installs, 1);
});
test('failed native preparation keeps the verified download and permits retry', async () => {
  const updater = new Transport(); let fail = true;
  const controller = new UpdateController({ currentVersion: '0.1.7', capability: 'automatic', automatic: false, updater,
    prepareInstall: async () => { if (fail) throw new Error('native staging failed'); } });
  await controller.check(); await controller.download(); updater.emit('update-downloaded', { version: '0.1.8' });
  await assert.rejects(controller.install(), /native staging failed/); assert.equal(updater.installs, 0);
  assert.equal(controller.getState().status, 'downloaded');
  fail = false; await controller.install(); assert.equal(updater.installs, 1);
});

test('Mac staging waits for native readiness, cleans listeners and can retry native errors', async () => {
  const { prepareMacUpdate } = await import('../src/desktop/updates');
  const native = Object.assign(new EventEmitter(), { checkForUpdates() {} });
  const pending = prepareMacUpdate(native);
  assert.equal(native.listenerCount('update-downloaded'), 1);
  native.emit('update-downloaded'); await pending;
  assert.equal(native.listenerCount('update-downloaded'), 0); assert.equal(native.listenerCount('error'), 0);
  const failure = prepareMacUpdate(native); native.emit('error', new Error('signature rejected'));
  await assert.rejects(failure, /signature rejected/);
  const retry = prepareMacUpdate(native); native.emit('update-downloaded'); await retry;
});
