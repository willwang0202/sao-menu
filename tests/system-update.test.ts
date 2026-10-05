import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, congratulationsPosition, CONGRATULATIONS_SIZE, isSystemUpdated, parseSystemRecord, systemLabel } from '../src/shared/system-update';

test('compares dotted versions numerically', () => {
  assert.equal(compareVersions('27.2', '27.10'), -1);
  assert.equal(compareVersions('10.0.26100', '10.0.22631'), 1);
  assert.equal(compareVersions('27.2', '27.2.0'), 0);
  assert.equal(compareVersions('6.8.0-45-generic', '6.8.0-41-generic'), 1);
});

test('first launch only records the system version', () => {
  assert.equal(isSystemUpdated(null, '27.2'), false);
});

test('celebrates when the system version increases', () => {
  assert.equal(isSystemUpdated('27.1', '27.2'), true);
});

test('does not celebrate an unchanged or older system version', () => {
  assert.equal(isSystemUpdated('27.2', '27.2'), false);
  assert.equal(isSystemUpdated('27.3', '27.2'), false);
});

test('reads only a well-formed stored record', () => {
  assert.equal(parseSystemRecord('{"version":"27.1"}'), '27.1');
  assert.equal(parseSystemRecord('{"version":42}'), null);
  assert.equal(parseSystemRecord('not json'), null);
  assert.equal(parseSystemRecord(JSON.stringify({ version: 'x'.repeat(200) })), null);
});

test('names the system for the banner', () => {
  assert.equal(systemLabel('darwin', '27.2'), 'macOS 27.2');
  assert.equal(systemLabel('win32', '10.0.26100'), 'Windows 10.0.26100');
  assert.equal(systemLabel('linux', '6.8.0'), 'Linux 6.8.0');
});

test('centres the banner in the upper third of the work area', () => {
  const area = { x: 0, y: 25, width: 1920, height: 1050 };
  const position = congratulationsPosition(area);
  assert.equal(position.x, (1920 - CONGRATULATIONS_SIZE.width) / 2);
  assert.equal(position.y, 25 + Math.round(1050 / 3 - CONGRATULATIONS_SIZE.height / 2));
});
