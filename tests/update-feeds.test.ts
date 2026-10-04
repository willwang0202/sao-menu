import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateFeeds } from '../src/shared/update-feeds';
const hash = Buffer.alloc(64, 1).toString('base64');
const report = (platform: string, arch: string, artifacts: string[]) => ({ version: '0.1.7', platform, arch, artifacts: artifacts.map(name => ({ name, bytes: 2000000, sha512: hash, sha256: 'a'.repeat(64) })) });
const reports = () => [
  report('darwin', 'arm64', ['sao-menu-0.1.7-mac-arm64.zip', 'sao-menu-0.1.7-mac-arm64.dmg']),
  report('darwin', 'x64', ['sao-menu-0.1.7-mac-x64.zip', 'sao-menu-0.1.7-mac-x64.dmg']),
  report('win32', 'x64', ['sao-menu-0.1.7-windows-x64.exe', 'sao-menu-0.1.7-windows-x64.zip']),
  report('linux', 'x64', ['sao-menu-0.1.7-linux-x86_64.AppImage', 'sao-menu-0.1.7-linux-amd64.deb']),
];
test('one Mac feed retains both architectures and their final signed hashes', () => {
  const input = reports(); input[0].artifacts[0].sha512 = Buffer.alloc(64, 2).toString('base64');
  const feeds = createUpdateFeeds(input, '0.1.7');
  assert.equal(feeds['latest-mac.yml'].files.length, 4);
  assert.equal(feeds['latest-mac.yml'].files.find(file => file.url.endsWith('arm64.zip'))?.sha512, input[0].artifacts[0].sha512);
  assert.ok(feeds['latest-mac.yml'].files.some(file => file.url.endsWith('x64.zip')));
  assert.equal(feeds['latest.yml'].path, 'sao-menu-0.1.7-windows-x64.exe');
  assert.equal(feeds['latest-linux.yml'].path, 'sao-menu-0.1.7-linux-x86_64.AppImage');
});
test('partial, duplicate, stale or corrupt reports cannot produce a public feed', () => {
  assert.throws(() => createUpdateFeeds(reports().slice(1), '0.1.7'));
  assert.throws(() => createUpdateFeeds([...reports(), reports()[0]], '0.1.7'));
  const stale = reports(); stale[0].version = '0.1.6'; assert.throws(() => createUpdateFeeds(stale, '0.1.7'));
  const bad = reports(); bad[1].artifacts[0].sha512 = 'invalid'; assert.throws(() => createUpdateFeeds(bad, '0.1.7'));
  const wrong = reports(); wrong[1].artifacts[0].name = 'sao-menu-0.1.6-mac-x64.zip'; assert.throws(() => createUpdateFeeds(wrong, '0.1.7'));
});
