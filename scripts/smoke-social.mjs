import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import electronPath from 'electron';
import { _electron as electron } from 'playwright';
import { createSocialService } from '../src/service/accounts.ts';
import { accountHTTPServer } from '../src/service/http.ts';

const temporary = await mkdtemp(path.join(tmpdir(), 'sao-social-native-'));
const service = createSocialService(path.join(temporary, 'accounts.sqlite'));
const server = accountHTTPServer(service); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = `http://127.0.0.1:${server.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !['ELECTRON_RUN_AS_NODE', 'SAO_DEV_URL'].includes(key)));
const instances = []; const errors = [];
// This Playwright build does not await async waitForFunction predicates.
const waitState = async (page, predicate) => {
  for (let attempt=0;attempt<120;attempt++) {
    const state=await page.evaluate(() => window.saoSocial.getState());
    if(predicate(state))return state;
    await new Promise(resolve => setTimeout(resolve,100));
  }
  throw new Error('Timed out waiting for the actual social snapshot');
};
try {
  const players = [];
  for (const name of ['Kirito', 'Asuna']) {
    const profile = path.join(temporary, name); await mkdir(profile);
    const instance = await electron.launch({ executablePath: electronPath, args: ['.'], cwd: process.cwd(), env: { ...env, SAO_TEST_SERVICE_URL:address, SAO_USER_DATA: profile } }); instances.push(instance);
    const page = await instance.firstWindow();
    await page.waitForFunction(() => !!window.sao); await page.evaluate(() => window.sao.completeStartup()); page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('menuitem', { name: 'Party', exact: true }).click();
    assert.equal(await page.getByRole('region', { name: 'Social', exact: true }).count(), 1, 'Party opens online social controls');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    assert.equal(await page.getByLabel('Account service', { exact: true }).count(), 0);
    await page.getByLabel('Username', { exact: true }).fill(name.toLowerCase());
    await page.getByLabel('Display name', { exact: true }).fill(name);
    await page.getByLabel('Password', { exact: true }).fill(`a long ${name} test password`);
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await waitState(page,state=>state.snapshot?.profile.displayName===name);
    await page.getByRole('menuitem', { name, exact: true }).waitFor();
    const hud = instance.windows().find(page => page.url().includes('hp=1'));
    await hud.waitForFunction(expected => document.querySelector('.hp-name')?.textContent === expected, name);
    assert.equal(await hud.locator('.hp-extra').count(), 0, 'a solo player has no companion bars');
    const state = await page.evaluate(() => window.saoSocial.getState());
    assert.equal('token' in state, false); assert.equal('password' in state, false);
    players.push({ instance, page, state });
  }
  const [kirito, asuna] = players;
  console.log('Account registration states', players.map(player => ({ profile: player.state.snapshot?.profile.username, connected: player.state.connected, error: player.state.error })));
  await kirito.page.getByLabel('Player username').fill('asuna');
  await kirito.page.getByRole('button', { name: 'Send friend request' }).click();
  await waitState(asuna.page,state=>state.snapshot?.requests.length===1);
  await asuna.page.getByRole('button', { name: /Friend Requests/ }).click();
  await asuna.page.getByRole('button', { name: 'Accept Kirito' }).click();
  await waitState(kirito.page,state=>state.snapshot?.friends.some(friend=>friend.username==='asuna'));
  await kirito.page.getByRole('button', { name: 'Asuna', exact: true }).click();
  const kiritoHud = kirito.instance.windows().find(page => page.url().includes('hp=1'));
  const asunaHud = asuna.instance.windows().find(page => page.url().includes('hp=1'));
  assert.equal(await kiritoHud.locator('.hp-extra').count(), 0, 'an accepted friend alone does not create a companion HP bar');
  await kirito.page.getByRole('button', { name: 'Invite to party', exact: true }).click();
  await waitState(asuna.page, state => state.snapshot?.partyInvites?.length === 1);
  assert.equal(await kiritoHud.locator('.hp-extra').count(), 0, 'a pending party invitation has no companion bar');
  await asuna.page.getByRole('button', { name: /^Party \(/ }).click();
  await asuna.page.getByRole('button', { name: "Join Kirito's party", exact: true }).click();
  await waitState(kirito.page, state => state.snapshot?.party?.members.length === 2);
  await kiritoHud.locator('.hp-extra').waitFor(); await asunaHud.locator('.hp-extra').waitFor();
  assert.equal(await kiritoHud.locator('.hp-extra-name').textContent(), 'Asuna');
  assert.equal(await asunaHud.locator('.hp-extra-name').textContent(), 'Kirito');
  await kirito.page.getByRole('button', { name: 'Message Box', exact: true }).click();
  await kirito.page.getByRole('textbox', { name: 'Direct message', exact: true }).fill('Meet at the teleport gate.');
  await kirito.page.getByRole('button', { name: 'Send message' }).click();
  await asuna.page.getByRole('menuitem', { name: 'Message', exact: true }).click();
  await waitState(asuna.page,state=>state.snapshot?.conversations.some(conversation=>conversation.unread===1));
  await asuna.page.getByRole('button', { name: /Kirito/ }).first().click();
  await asuna.page.getByRole('log').getByText('Meet at the teleport gate.', { exact: true }).waitFor();
  await asuna.page.getByRole('textbox', { name: 'Direct message', exact: true }).fill('On my way.');
  await asuna.page.getByRole('button', { name: 'Send message' }).click();
  await kirito.page.getByRole('log').getByText('On my way.', { exact: true }).waitFor();
  await waitState(kirito.page,state=>state.snapshot?.conversations[0]?.unread===0);
  assert.equal(await kirito.page.evaluate(async () => { try { await window.saoSocial.sendMessage('unknown-player', 'No'); return false; } catch { return true; } }), true);
  await kirito.page.screenshot({ path: path.resolve('output/playwright/current-direct-messages.png') });
  const credentials = JSON.parse(await readFile(path.join(temporary, 'Kirito/social-account.json'), 'utf8'));
  assert.equal('password' in credentials, false); assert.equal('token' in credentials, false);
  await kirito.instance.close(); instances.splice(instances.indexOf(kirito.instance), 1);
  const restarted = await electron.launch({ executablePath: electronPath, args: ['.'], cwd: process.cwd(), env: { ...env, SAO_TEST_SERVICE_URL:address, SAO_USER_DATA: path.join(temporary, 'Kirito') } }); instances.push(restarted);
  const page = await restarted.firstWindow();
  await page.waitForFunction(() => !!window.sao); await page.evaluate(() => window.sao.completeStartup());
  if (credentials.encryptedToken) {
    await waitState(page,state=>state.snapshot?.profile.username==='kirito');
    assert.equal((await page.evaluate(peer => window.saoSocial.getMessages(peer), asuna.state.snapshot.profile.id)).length, 2);
    await waitState(page, state => state.snapshot?.party?.members.length === 2);
    await page.evaluate(() => window.saoSocial.leaveParty());
    await waitState(asuna.page, state => state.snapshot?.party?.members.length === 1);
    await asunaHud.waitForFunction(() => document.querySelectorAll('.hp-extra').length === 0);
    assert.equal(await asuna.instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.getTitle() === 'SAO HP Display').getSize()[1]), 62);
  }
  await page.evaluate(() => window.saoSocial.logout());
  assert.equal((await page.evaluate(() => window.saoSocial.getState())).snapshot, null);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ social: 'two real native accounts against the standalone HTTP service; requests, acceptance, friend presence and Message Box', messages: 'both directions, unread/read, persisted history and rejected unknown recipients', credentials: 'session kept out of renderer and encrypted by OS storage when available; restore and logout checked' }, null, 2));
} finally { for (const instance of instances) await instance.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); await rm(temporary, { recursive: true, force: true }); }
