import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, normalizeSettings, parseConfiguration, validateLauncher } from '../src/shared/settings';

test('recovers corrupt preferences and drops obsolete prototype fields', () => {
  const next = normalizeSettings({ playerName: '', accent: 'invalid', widgets: { clock: false }, positions: { clock: { x: -900, y: 90000 }, system: { x: NaN, y: 0 } }, favorites: [null], notes: 'line\nline' }, 'darwin');
  assert.equal(next.playerName, 'Kirito'); assert.deepEqual(next.favorites, []);
  for (const key of ['accent', 'widgets', 'positions', 'notes']) assert.equal(key in next, false);
});

test('rejects shell/protocol/control-character targets and credentialed URLs', () => {
  for (const target of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:secret@example.com', 'https://example.com/\u0000']) {
    assert.throws(() => validateLauncher({ id: 'x', name: 'Link', kind: 'url', target }));
  }
  assert.throws(() => validateLauncher({ id: 'x', name: 'Shell', kind: 'application', target: 'calc.exe' }));
  assert.equal(validateLauncher({ id: 'x', name: 'Safari', kind: 'application', target: '/Applications/Safari.app' }).target, '/Applications/Safari.app');
});

test('JSON migration skips foreign paths and preserves native startup preferences', () => {
  const current = { ...defaultSettings('darwin'), shortcut: 'CommandOrControl+Alt+S' };
  const result = parseConfiguration(JSON.stringify({ ...defaultSettings('win32'), launchAtLogin: true, alwaysOnTop: true, favorites: [
    { id: 'a', name: 'Windows app', kind: 'application', target: 'C:\\Windows\\notepad.exe' },
    { id: 'b', name: 'Docs', kind: 'url', target: 'https://example.com' },
  ] }), current, 'darwin');
  assert.equal(result.imported, 1); assert.equal(result.warnings.length, 1);
  assert.equal(result.settings.launchAtLogin, false); assert.equal(result.settings.alwaysOnTop, false);
  assert.equal(result.settings.shortcut, current.shortcut);
});

test('original XML imports links, merges duplicates, and warns about native actions', () => {
  const source = `<root><menu><item id="0"><type>100</type><label>Tools</label><menu>
    <item id="1"><type>1</type><label>Documentation</label><action>{"source":"nvg://system/action#open","data":{"type":2,"url":"https://example.com/docs"}}</action></item>
    <item id="2"><type>1</type><label>Calculator</label><action>{"source":"nvg://system/action#cmd","data":{"command":"calc.exe"}}</action></item>
  </menu></item></menu></root>`;
  const first = parseConfiguration(source, defaultSettings('darwin'), 'darwin');
  assert.equal(first.imported, 1); assert.match(first.warnings[0], /Calculator/);
  assert.equal(first.settings.favorites[0].target, 'https://example.com/docs');
  const second = parseConfiguration(source, first.settings, 'darwin');
  assert.equal(second.imported, 0); assert.equal(second.settings.favorites.length, 1);
});

test('configuration parser rejects oversized data, malformed XML, entities and unknown versions', () => {
  const current = defaultSettings('darwin');
  for (const source of ['x'.repeat(2 * 1024 * 1024 + 1), '<root><menu></root>', '<!DOCTYPE root [<!ENTITY x SYSTEM "file:///etc/passwd">]><root><menu/></root>', '{"version":2,"favorites":[]}', '[]']) {
    assert.throws(() => parseConfiguration(source, current, 'darwin'));
  }
});

test('original XML decodes ordinary escaped labels and URL parameters', () => {
  const source = '<root><menu><item><label>Tools &amp; docs</label><action>{"source":"nvg://system/action#open","data":{"url":"https://example.com/?a=1&amp;b=2"}}</action></item></menu></root>';
  const imported = parseConfiguration(source, defaultSettings('darwin'), 'darwin');
  assert.equal(imported.settings.favorites[0].name, 'Tools & docs');
  assert.equal(imported.settings.favorites[0].target, 'https://example.com/?a=1&b=2');
});

test('deduplicates stored favorite IDs and bounds menu depth', () => {
  const favorite = { id: 'x', name: 'Site', kind: 'url', target: 'https://example.com' };
  assert.equal(normalizeSettings({ favorites: [favorite, favorite], notes: 'a'.repeat(60000) }, 'web').favorites.length, 1);
  const nested = '<root><menu>' + '<item><menu>'.repeat(34) + '</menu></item>'.repeat(34) + '</menu></root>';
  assert.throws(() => parseConfiguration(nested, defaultSettings('darwin'), 'darwin'), /deeply/);
});

test('hand tracking is off by default, recovers from corrupt values, and survives a save round trip', () => {
  assert.equal(defaultSettings('darwin').handTracking, false);
  assert.equal(normalizeSettings({ handTracking: 'yes' }, 'darwin').handTracking, false);
  assert.equal(normalizeSettings({ handTracking: true }, 'darwin').handTracking, true);
});

test('importing a configuration keeps the local camera choices', () => {
  const current = { ...defaultSettings('darwin'), handTracking: true };
  const result = parseConfiguration(JSON.stringify({ ...defaultSettings('win32'), handTracking: false, handDebugView: true }), current, 'darwin');
  assert.equal(result.settings.handTracking, true);
  assert.equal(result.settings.handDebugView, false, 'an imported file never shows the camera feed');
});

test('the camera debug view is off by default and recovers from corrupt values', () => {
  assert.equal(defaultSettings('darwin').handDebugView, false);
  assert.equal(normalizeSettings({ handDebugView: 1 }, 'darwin').handDebugView, false);
  assert.equal(normalizeSettings({ handDebugView: true }, 'darwin').handDebugView, true);
});

test('automatic updates default on, persist off and stay local when importing', () => {
  assert.equal(defaultSettings('darwin').automaticUpdates, true);
  assert.equal(normalizeSettings({ automaticUpdates: false }, 'darwin').automaticUpdates, false);
  assert.equal(normalizeSettings({ automaticUpdates: 'false' }, 'darwin').automaticUpdates, true);
  const current = { ...defaultSettings('darwin'), automaticUpdates: false };
  assert.equal(parseConfiguration(JSON.stringify(defaultSettings('win32')), current, 'darwin').settings.automaticUpdates, false);
});

test('defaults to the SAO theme and keeps a known ALO or GGO theme choice', () => {
  assert.equal(defaultSettings('darwin').theme, 'sao');
  assert.equal(normalizeSettings({ theme: 'ggo' }, 'darwin').theme, 'ggo');
  assert.equal(normalizeSettings({ theme: 'alo' }, 'darwin').theme, 'alo');
  assert.equal(normalizeSettings({ theme: 'windows-xp' }, 'darwin').theme, 'sao');
});

test('shows the clock and message widgets by default and keeps a saved choice', () => {
  const defaults = defaultSettings('darwin');
  assert.equal(defaults.showClock, true); assert.equal(defaults.showMessageButton, true);
  const hidden = normalizeSettings({ showClock: false, showMessageButton: false }, 'darwin');
  assert.equal(hidden.showClock, false); assert.equal(hidden.showMessageButton, false);
  assert.equal(normalizeSettings({ showClock: 'no' }, 'darwin').showClock, true);
});

test('plays the Link Start animation unless the player turns it off', () => {
  assert.equal(normalizeSettings({}, 'darwin').showStartupAnimation, true);
  assert.equal(normalizeSettings({ showStartupAnimation: false }, 'darwin').showStartupAnimation, false);
  assert.equal(normalizeSettings({ showStartupAnimation: 'no' }, 'darwin').showStartupAnimation, true);
});
