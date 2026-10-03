import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, normalizeSettings, parseConfiguration } from '../src/shared/settings';
import { resolveNativeMenu, buildDefaultMenu } from '../src/shared/menu';

test('original hierarchy retains native commands as known declarative mappings', () => {
  const source = '<root><menu><item id="user"><type>100</type><label>Kirito</label><text>Welcome</text><menu><item id="user.skills"><type>100</type><label>Skills</label><menu><item id="user.calculator"><label>Calculator</label><action>{"source":"nvg://system/action#cmd","data":{"command":"calc.exe"}}</action></item><item id="unsafe"><label>Custom command</label><action>{"source":"nvg://system/action#cmd","data":{"command":"calc.exe &amp; arbitrary-script"}}</action></item></menu></item></menu></item></menu></root>';
  const parsed = parseConfiguration(source, defaultSettings('darwin'), 'darwin');
  const root = parsed.settings.menu![0];
  assert.equal(root.name, 'Kirito'); assert.equal(root.description, 'Welcome'); assert.equal(root.icon, 'symbol/info.png');
  const children = root.children![0].children!;
  assert.equal(children[0].nativeTarget, 'app:calculator');
  assert.equal(children[1].kind, 'unsupported'); assert.equal(children[1].nativeTarget, undefined);
  const native = resolveNativeMenu(parsed.settings.menu!, 'darwin', [], '/Users/example');
  assert.equal(native[0].children![0].children![0].launcher!.target, '/System/Applications/Calculator.app');
});

test('folder shortcuts outside the social roots resolve to native app catalogue and Desktop', () => {
  const source = '<root><menu><item id="navigation.apps"><type>101</type><label>Applications</label><folder><path>file:///%ProgramData%/Microsoft/Windows/Start Menu/Programs</path></folder></item><item id="navigation.desktop"><type>101</type><label>Desktop</label><folder><path>file:///%UserProfile%/Desktop</path></folder></item></menu></root>';
  const parsed = parseConfiguration(source, defaultSettings('darwin'), 'darwin');
  const apps = [{ id: 'a', name: 'Calculator', kind: 'application' as const, target: '/System/Applications/Calculator.app' }];
  const menu = resolveNativeMenu(parsed.settings.menu!, 'darwin', apps, '/Users/example');
  assert.equal(menu[0].children![0].launcher!.target, apps[0].target);
  assert.equal(menu[1].directory, '/Users/example/Desktop');
});

test('normalization limits theme paths and cross-platform executable menu entries', () => {
  const next = normalizeSettings({ menu: [{ id: 'x', name: 'Unsafe asset', kind: 'launcher', icon: '../../secret.png', launcher: { id: 'x', name: 'Foreign app', kind: 'application', target: 'C:\\Windows\\notepad.exe' } }] }, 'darwin');
  assert.equal(next.menu![0].kind, 'unsupported'); assert.equal(next.menu![0].icon, undefined);
});

test('default menu preserves original category labels and Alt+S activation', () => {
  assert.deepEqual(buildDefaultMenu('darwin', [], []).map(item => item.name), ['Kirito', 'Party', 'Message', 'Navigation', 'Settings']);
  assert.equal(defaultSettings('darwin').shortcut, 'Alt+S');
});
