import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import electronPath from 'electron';
import { _electron as electron } from 'playwright';

const userData = await mkdtemp(path.join(tmpdir(), 'sao-desktop-smoke-'));
const output = path.resolve('output/playwright');
await mkdir(output, { recursive: true });
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !['ELECTRON_RUN_AS_NODE', 'SAO_DEV_URL'].includes(key)));
const instance = await electron.launch({ executablePath: electronPath, args: ['.'], cwd: process.cwd(), env: { ...env, SAO_USER_DATA: userData, SAO_TEST_NO_DEVICE_LOCATION: '1' }, timeout: 30000 });
const errors = [];
try {
  const page = await instance.firstWindow();
    await page.waitForFunction(() => !!window.sao); await page.evaluate(() => window.sao.completeStartup());
  page.on('pageerror', error => errors.push(error.message));
  await instance.evaluate(({ BrowserWindow }) => {
    const primary = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html'));
    // This fixture drives its own input. Physical clicks in another app must
    // not dismiss the disposable test window during unrelated assertions.
    const send = primary.webContents.send.bind(primary.webContents);
    primary.webContents.send = (channel, ...args) => { if (!['sao:pointer:down', 'sao:menu:dismiss'].includes(channel)) send(channel, ...args); };
  });
  await page.getByRole('menuitem', { name: 'Kirito', exact: true }).waitFor();
  // Source pixel measurements exclude the independent cursor compositor.
  await page.addStyleTag({ content: '.hologram-content{transform:none!important}' });
  const runtime = await page.evaluate(() => window.sao.getRuntime());
  assert.equal(runtime.desktop, true);
  assert.equal(runtime.platform, process.platform);
  const applications = await page.evaluate(() => window.sao.listApplications());
  assert.ok(applications.length > 0, 'native applications discovered');
  const stats = await page.evaluate(() => window.sao.getSystemStats());
  assert.ok(stats.memoryTotal > 0 && stats.memoryUsed >= 0 && stats.uptime > 0);
  const isolation = await page.evaluate(() => ({ node: typeof window.require, process: typeof window.process }));
  assert.deepEqual(isolation, { node: 'undefined', process: 'undefined' });
  const secure = await instance.evaluate(({ BrowserWindow }) => {
    const preferences = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).webContents.getLastWebPreferences();
    return { sandbox: preferences.sandbox, isolation: preferences.contextIsolation, node: preferences.nodeIntegration };
  });
  assert.deepEqual(secure, { sandbox: true, isolation: true, node: false });
  const storage = await instance.evaluate(({ app }) => ({ name: app.getName(), userData: app.getPath('userData') }));
  const gesture = await page.evaluate(() => window.sao.getGestureStatus());
  assert.equal(gesture.supported, process.platform === 'darwin');
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(async () => ({ sao: (await document.fonts.load('500 15px "SAO UI"')).length, cjk: (await document.fonts.load('500 15px "Source Han Sans"', '百度一下')).length }));
  assert.equal(fonts.sao, 1); assert.equal(fonts.cjk, 1);
  await page.locator('.submenu-column').first().waitFor();
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
  const geometry = await page.evaluate(() => {
    const size = selector => { const element = document.querySelector(selector); const rect = element.getBoundingClientRect(); return { width: rect.width, height: rect.height }; };
    return { root: size('.root-path'), button: size('.root-button'), column: size('.submenu-column'), row: size('.item-button'), panel: size('.info-panel'), categories: [...document.querySelectorAll('.root-button')].map(button => button.getAttribute('aria-label')) };
  });
  assert.deepEqual(geometry.root, { width: 64, height: 414 });
  assert.deepEqual(geometry.button, { width: 64, height: 64 });
  assert.deepEqual(geometry.column, { width: 182, height: 310 });
  assert.deepEqual(geometry.row, { width: 182, height: 46 });
  assert.equal(geometry.panel.width, 270);
  assert.deepEqual(geometry.categories, ['Kirito', 'Party', 'Message', 'Navigation', 'Settings']);
  if (['darwin', 'win32'].includes(process.platform)) {
    const control = await page.locator('.root-button').first().boundingBox();
    await instance.evaluate(({ BrowserWindow, screen }, point) => {
      const primary = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html'));
      const original = primary.setIgnoreMouseEvents.bind(primary);
      primary.setIgnoreMouseEvents = (enabled, options) => { primary.pointerTest = { enabled, options }; return original(enabled, options); };
      primary.originalCursor = screen.getCursorScreenPoint;
      primary.testPointer = point;
      screen.getCursorScreenPoint = () => { const bounds = primary.getBounds(); return { x: primary.testPointer.x + bounds.x, y: primary.testPointer.y + bounds.y }; };
    }, { x: control.x + control.width / 2, y: control.y + control.height / 2 });
    // Establish the inside state before expecting an outside transition.
    // The renderer intentionally skips duplicate native ownership writes.
    await page.waitForFunction(() => document.querySelector('.root-button')?.classList.contains('hovered'));
    await instance.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).testPointer = { x: 10, y: 10 }; });
    await page.mouse.move(10, 10);
    await page.waitForFunction(() => window.sao && !document.querySelector('.hovered'));
    await instance.evaluate(async ({ BrowserWindow }) => {
      const primary = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html'));
      for (let attempt = 0; attempt < 50; attempt++) {
        if (primary.pointerTest?.enabled === true) return;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error('Native pointer did not enable outside passthrough');
    });
    const outside = await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).pointerTest);
    assert.equal(outside.enabled, true); assert.equal(outside.options.forward, true);
    await instance.evaluate(({ BrowserWindow }, point) => { BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).testPointer = point; }, { x: control.x + control.width / 2, y: control.y + control.height / 2 });
    await page.mouse.move(control.x + control.width / 2, control.y + control.height / 2);
    await page.waitForFunction(() => document.querySelector('.root-button')?.classList.contains('hovered'));
    assert.equal((await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).pointerTest)).enabled, false);
    await instance.evaluate(({ BrowserWindow, screen }) => { screen.getCursorScreenPoint = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).originalCursor; });
  }
  await page.screenshot({ path: path.join(output, 'original-menu.png'), animations: 'disabled' });
  const railPositions = () => page.locator('.root-button').evaluateAll(buttons => buttons.map(button => {
    const rect = button.getBoundingClientRect();
    return { name: button.getAttribute('aria-label'), x: rect.x, y: rect.y };
  }));
  const beforeSwitch = await railPositions();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Option', exact: true }).waitFor();
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
  assert.deepEqual(await railPositions(), beforeSwitch, 'category selection must not scroll the rail');
  const expansionAnchor = () => page.evaluate(() => {
    const button = document.querySelector('.root-button.selected').getBoundingClientRect();
    const menu = document.querySelector('.submenu-column').getBoundingClientRect();
    const panel = document.querySelector('.info-panel').getBoundingClientRect();
    return { buttonCenter: button.y + button.height / 2, menuCenter: menu.y + menu.height / 2, panelTop: panel.y };
  });
  const waitForAnchor = () => page.waitForFunction(() => {
    const button = document.querySelector('.root-button.selected')?.getBoundingClientRect();
    const menu = document.querySelector('.submenu-column')?.getBoundingClientRect();
    return button && menu && Math.abs(menu.y + menu.height / 2 - button.y - button.height / 2) < .1;
  });
  await waitForAnchor();
  const optionsAnchor = await expansionAnchor();
  assert.ok(Math.abs(optionsAnchor.menuCenter - optionsAnchor.buttonCenter) < 1, 'Settings menu follows its own button');
  assert.ok(Math.abs(optionsAnchor.panelTop + 215 - optionsAnchor.buttonCenter) < 1, 'information panel follows the category');
  await page.screenshot({ path: path.join(output, 'switch-settings.png'), animations: 'disabled' });
  await page.getByRole('menuitem', { name: 'Kirito', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Skills', exact: true }).waitFor();
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
  await waitForAnchor();
  assert.deepEqual(await railPositions(), beforeSwitch, 'switching back preserves category positions');
  const selfAnchor = await expansionAnchor();
  assert.ok(Math.abs(selfAnchor.menuCenter - selfAnchor.buttonCenter) < 1);
  assert.ok(Math.abs(optionsAnchor.menuCenter - selfAnchor.menuCenter - 280) < 1, `expanded menus move by the category spacing: ${JSON.stringify({ optionsAnchor, selfAnchor })}`);
  await page.getByRole('menuitem', { name: 'Equipment', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Calculator', exact: true }).waitFor();
  assert.equal(await page.locator('.submenu-column').count(), 2);
  if (process.platform === 'darwin') {
    const isCalculatorRunning = () => { try { execFileSync('pgrep', ['-x', 'Calculator']); return true; } catch { return false; } };
    const wasCalculatorRunning = isCalculatorRunning();
    await page.getByRole('menuitem', { name: 'Calculator', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.original-menu'));
    // Quit the Calculator this test opened; leave one the user already had open.
    if (!wasCalculatorRunning) {
      const deadline = Date.now() + 10000;
      while (!isCalculatorRunning() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 200));
      assert.equal(isCalculatorRunning(), true, 'Equipment → Calculator launches Calculator');
      execFileSync('osascript', ['-e', 'tell application "Calculator" to quit']);
    }
    await instance.evaluate(({ app }) => app.emit('activate'));
    await page.getByRole('menuitem', { name: 'Kirito', exact: true }).waitFor();
  }

  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  // Help opens the support page in the default browser; unit tests cover its link, so it isn't clicked here.
  await page.getByRole('menuitem', { name: 'Help', exact: true }).waitFor();
  await page.getByRole('menuitem', { name: 'Option', exact: true }).click();
  assert.equal(await page.getByLabel('Account display name').inputValue(), 'Kirito');
  assert.equal(await page.getByLabel('Account display name').getAttribute('readonly'), '');
  // Old local preferences remain importable; the UI gets its identity from the account.
  await page.evaluate(async () => { const settings = await window.sao.getSettings(); await window.sao.saveSettings({ ...settings, playerName: 'Smoke Player' }); });
  assert.equal((await page.evaluate(() => window.sao.getSettings())).playerName, 'Smoke Player');
  assert.equal(await page.getByRole('button', { name: 'Widgets', exact: true }).count(), 0);
  for (const obsolete of ['accent', 'widgets', 'positions', 'notes']) assert.equal(obsolete in await page.evaluate(() => window.sao.getSettings()), false);

  const invalid = await page.evaluate(async () => {
    try { await window.sao.launch({ id: 'unsafe', name: 'Unsafe', kind: 'url', target: 'file:///etc/passwd' }); return false; } catch { return true; }
  });
  assert.equal(invalid, true, 'unsafe launch rejected by native bridge');
  assert.equal(await page.evaluate(async () => { try { await window.sao.setPointerPassthrough('invalid'); return false; } catch { return true; } }), true);
  const beforeShortcut = await page.evaluate(() => window.sao.getSettings());
  await page.evaluate(async () => {
    const before = await window.sao.getSettings();
    try { await window.sao.saveSettings({ ...before, shortcut: 'DefinitelyNotAKey' }); } catch { return; }
    throw new Error('Invalid shortcut unexpectedly accepted');
  });
  assert.equal((await page.evaluate(() => window.sao.getSettings())).shortcut, beforeShortcut.shortcut);

  // Only the native chooser is substituted; the IPC, parser, queue and filesystem remain real.
  const importPath = path.join(userData, 'original-menu.xml');
  await writeFile(importPath, '<root><menu><item><label>Portable link</label><action>{"source":"nvg://system/action#open","data":{"url":"https://example.com"}}</action></item><item><label>Windows action</label><action>{"source":"nvg://system/action#cmd","data":{"command":"calc.exe"}}</action></item></menu></root>');
  await instance.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, importPath);
  const imported = await page.evaluate(() => window.sao.importConfiguration());
  assert.equal(imported.imported, 1); assert.equal(imported.warnings.length, 1);
  const exportPath = path.join(userData, 'exported.json');
  await instance.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, exportPath);
  assert.equal(await page.evaluate(() => window.sao.exportConfiguration()), true);
  assert.equal(JSON.parse(await readFile(exportPath, 'utf8')).playerName, 'Smoke Player');

  const strayDenied = await instance.evaluate(async ({ BrowserWindow }, preload) => {
    const primary = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html'));
    const other = new BrowserWindow({ show: false, webPreferences: { preload, sandbox: true, contextIsolation: true, nodeIntegration: false } });
    await other.loadURL(primary.webContents.getURL());
    try { return await other.webContents.executeJavaScript('window.sao ? window.sao.getSettings().then(() => false, () => true) : "missing-preload"'); } finally { other.destroy(); }
  }, path.resolve('dist-desktop/preload.cjs'));
  assert.equal(strayDenied, true, 'untrusted IPC sender rejected');
  const widgets = await instance.evaluate(async ({ BrowserWindow }) => {
    const find = kind => BrowserWindow.getAllWindows().find(window => new URL(window.webContents.getURL()).searchParams.get('widget') === kind);
    const clock = find('clock'), message = find('message');
    const clockTime = clock ? await clock.webContents.executeJavaScript("document.querySelector('.sao-clock')?.getAttribute('aria-label') ?? ''") : '';
    const messageButton = message ? await message.webContents.executeJavaScript("!!document.querySelector('.sao-message-button')") : false;
    const hp = BrowserWindow.getAllWindows().find(window => new URL(window.webContents.getURL()).searchParams.get('hp') === '1');
    return { clockSize: clock?.getSize(), messageSize: message?.getSize(), clockTime, messageButton, clockFocusable: clock?.isFocusable(), messageVisible: message?.isVisible(), stacking: [clock, message, hp].map(window => window?.isAlwaysOnTop()) };
  });
  assert.deepEqual(widgets.clockSize, [304, 80], 'original clock widget size');
  assert.deepEqual(widgets.messageSize, [56, 56], 'original mail button size');
  assert.match(widgets.clockTime, /^Time \d\d:\d\d$/, 'clock renders the original %H:%M time');
  assert.equal(widgets.messageButton, true, 'message button renders');
  assert.equal(widgets.messageVisible, false, 'the Message button stays hidden without unread messages');
  const alwaysOnTop = (await page.evaluate(() => window.sao.getSettings())).alwaysOnTop;
  assert.deepEqual(widgets.stacking, [alwaysOnTop, alwaysOnTop, alwaysOnTop], 'HP and widgets follow the Always on top setting');
  await page.getByRole('button', { name: 'Close options', exact: true }).first().click();
  await page.reload();
  await page.waitForFunction(() => Boolean(document.querySelector('.original-menu')));
  assert.equal((await page.evaluate(() => window.sao.getSettings())).playerName, 'Smoke Player');
  await page.evaluate(() => window.sao.hide());
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).isVisible()), false);
  await instance.evaluate(({ app }) => app.emit('activate'));
  await page.locator('.original-menu').waitFor({ state: 'visible' });
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).isVisible()), true);
  await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).webContents.send('sao:menu:toggle'));
  await page.waitForFunction(() => !document.querySelector('.original-menu'));
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).isVisible()), false, 'hotkey dismissal hides native window after its original transition');
  await instance.evaluate(({ app }) => app.emit('activate'));
  await page.locator('.original-menu').waitFor({ state: 'visible' });
  assert.deepEqual(errors, []);
  // Earlier steps import a custom menu; restore the bundled hierarchy, which has Message.
  await page.evaluate(async () => { const current = await window.sao.getSettings(); await window.sao.saveSettings({ ...current, menu: undefined }); });
  await page.reload(); await page.waitForSelector('.sao-desktop');
  await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => new URL(window.webContents.getURL()).searchParams.get('widget') === 'message').webContents.executeJavaScript('window.saoWidget.openMessages()'));
  await page.waitForFunction(() => document.querySelector('.root-button.selected')?.getAttribute('aria-label') === 'Message', null, { timeout: 5000 });
  assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html')).isVisible()), true, 'Message button summons the launcher');
  // Navigation → Field Map opens the SAO map window; without device location it centres on the saved home.
  await page.evaluate(async () => { const current = await window.sao.getSettings(); await window.sao.saveSettings({ ...current, mapHome: { label: 'Taipei City Hall', latitude: 25.0375, longitude: 121.5637 } }); });
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
  await page.getByRole('menuitem', { name: 'Navigation', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Field Map', exact: true }).click();
  await page.waitForSelector('.field-map .maplibregl-canvas');
  await page.waitForFunction(() => document.querySelector('.field-map-caption strong')?.textContent === 'Taipei City Hall', null, { timeout: 15000 });
  assert.match(await page.locator('.field-map-meta span').first().textContent(), /^N 25\.0375°\s+E 121\.5637°/);
  assert.ok(!errors.some(error => /worker/i.test(error)), `Map worker failed: ${errors.join('; ')}`);
  await page.waitForTimeout(9000);
  await page.screenshot({ path: path.join(output, 'field-map.png') });
  console.log(JSON.stringify({ platform: runtime.platform, applications: applications.length, memoryTotal: stats.memoryTotal, shortcutRegistered: runtime.shortcutRegistered, storage, gesture, geometry, fonts, categorySwitch: { selfAnchor, optionsAnchor, railUnchanged: true }, assertions: 'original assets and geometry, clock and message widgets, Message button opens Message, Field Map, anchored category switching, cascading menus, native launch, pointer passthrough, bridge isolation, IPC owner, settings, import/export, hotkey dismissal, hide/reopen, reload', screenshot: path.join(output, 'original-menu.png'), userData }, null, 2));
} finally { await instance.close(); await rm(userData, { recursive: true, force: true }); }
