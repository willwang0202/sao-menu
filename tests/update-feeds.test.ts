import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateFeeds } from '../src/shared/update-feeds';
const hash = Buffer.alloc(64, 1).toString('base64');
const report = (platform: string, arch: string, artifacts: string[]) => ({ version: '0.1.9', platform, arch, artifacts: artifacts.map(name => ({ name, bytes: 2000000, sha512: hash, sha256: 'a'.repeat(64) })) });
const reports = () => [
  report('darwin', 'universal', ['sao-menu-0.1.9-mac-universal.zip', 'sao-menu-0.1.9-mac-universal.dmg']),
  report('win32', 'universal', ['sao-menu-0.1.9-windows-universal.exe']),
  report('linux', 'x64', ['sao-menu-0.1.9-linux-x86_64.AppImage']),
];
test('feeds point at the single universal Mac, universal Windows and Linux builds', () => {
  const input = reports(); input[0].artifacts[0].sha512 = Buffer.alloc(64, 2).toString('base64');
  const feeds = createUpdateFeeds(input, '0.1.9');
  assert.deepEqual(feeds['latest-mac.yml'].files.map(file => file.url), ['sao-menu-0.1.9-mac-universal.zip', 'sao-menu-0.1.9-mac-universal.dmg']);
  assert.equal(feeds['latest-mac.yml'].path, 'sao-menu-0.1.9-mac-universal.zip');
  assert.equal(feeds['latest-mac.yml'].sha512, input[0].artifacts[0].sha512);
  assert.equal(feeds['latest.yml'].path, 'sao-menu-0.1.9-windows-universal.exe');
  assert.equal(feeds['latest-linux.yml'].path, 'sao-menu-0.1.9-linux-x86_64.AppImage');
});
test('partial, duplicate, stale, extra or corrupt reports cannot produce a public feed', () => {
  assert.throws(() => createUpdateFeeds(reports().slice(1), '0.1.9'));
  assert.throws(() => createUpdateFeeds([...reports(), reports()[0]], '0.1.9'));
  const stale = reports(); stale[0].version = '0.1.8'; assert.throws(() => createUpdateFeeds(stale, '0.1.9'));
  const bad = reports(); bad[1].artifacts[0].sha512 = 'invalid'; assert.throws(() => createUpdateFeeds(bad, '0.1.9'));
  const extra = reports(); extra[2].artifacts.push({ ...extra[2].artifacts[0], name: 'sao-menu-0.1.9-linux-amd64.deb' }); assert.throws(() => createUpdateFeeds(extra, '0.1.9'));
});
