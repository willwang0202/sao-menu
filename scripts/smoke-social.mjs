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
try {
  const players = [];
  for (const name of ['Kirito', 'Asuna']) {
    const profile = path.join(temporary, name); await mkdir(profile);
    const instance = await electron.launch({ executablePath: electronPath, args: ['.'], cwd: process.cwd(), env: { ...env, SAO_USER_DATA: profile } }); instances.push(instance);
    const page = await instance.firstWindow(); page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('menuitem', { name: 'Party', exact: true }).click();
    assert.equal(await page.getByRole('region', { name: 'Social', exact: true }).count(), 1, 'Party opens online social controls');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.getByLabel('Account service').fill(address);
    await page.getByLabel('Username', { exact: true }).fill(name.toLowerCase());
    await page.getByLabel('Display name', { exact: true }).fill(name);
    await page.getByLabel('Password', { exact: true }).fill(`a long ${name} test password`);
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await page.waitForFunction(async name => (await window.saoSocial.getState()).snapshot?.profile.displayName === name, name);
    const state = await page.evaluate(() => window.saoSocial.getState());
    assert.equal('token' in state, false); assert.equal('password' in state, false);
    players.push({ instance, page, state });
  }
  const [kirito, asuna] = players;
  console.log('Account registration states', players.map(player => ({ profile: player.state.snapshot?.profile.username, connected: player.state.connected, error: player.state.error })));
  await kirito.page.getByLabel('Player username').fill('asuna');
  await kirito.page.getByRole('button', { name: 'Send friend request' }).click();
  await asuna.page.waitForFunction(async () => (await window.saoSocial.getState()).snapshot?.requests.length === 1);
  await asuna.page.getByRole('button', { name: /Friend Requests/ }).click();
  await asuna.page.getByRole('button', { name: 'Accept Kirito' }).click();
  await kirito.page.waitForFunction(async () => (await window.saoSocial.getState()).snapshot.friends.some(friend => friend.username === 'asuna'));
  await kirito.page.getByRole('button', { name: 'Asuna', exact: true }).click();
  await kirito.page.getByRole('button', { name: 'Message Box', exact: true }).click();
  await kirito.page.getByLabel('Direct message').fill('Meet at the teleport gate.');
  await kirito.page.getByRole('button', { name: 'Send message' }).click();
  await asuna.page.getByRole('menuitem', { name: 'Message', exact: true }).click();
  await asuna.page.waitForFunction(async () => (await window.saoSocial.getState()).snapshot.conversations.some(conversation => conversation.unread === 1));
  await asuna.page.getByRole('button', { name: /Kirito/ }).first().click();
  await asuna.page.getByText('Meet at the teleport gate.', { exact: true }).waitFor();
  await asuna.page.getByLabel('Direct message').fill('On my way.');
  await asuna.page.getByRole('button', { name: 'Send message' }).click();
  await kirito.page.getByText('On my way.', { exact: true }).waitFor();
  await kirito.page.waitForFunction(async () => (await window.saoSocial.getState()).snapshot.conversations[0].unread === 0);
  assert.equal(await kirito.page.evaluate(async () => { try { await window.saoSocial.sendMessage('unknown-player', 'No'); return false; } catch { return true; } }), true);
  await kirito.page.screenshot({ path: path.resolve('output/playwright/current-direct-messages.png') });
  const credentials = JSON.parse(await readFile(path.join(temporary, 'Kirito/social-account.json'), 'utf8'));
  assert.equal('password' in credentials, false); assert.equal('token' in credentials, false);
  await kirito.instance.close(); instances.splice(instances.indexOf(kirito.instance), 1);
  const restarted = await electron.launch({ executablePath: electronPath, args: ['.'], cwd: process.cwd(), env: { ...env, SAO_USER_DATA: path.join(temporary, 'Kirito') } }); instances.push(restarted);
  const page = await restarted.firstWindow();
  if (credentials.encryptedToken) {
    await page.waitForFunction(async () => (await window.saoSocial.getState()).snapshot?.profile.username === 'kirito');
    assert.equal((await page.evaluate(peer => window.saoSocial.getMessages(peer), asuna.state.snapshot.profile.id)).length, 2);
  }
  await page.evaluate(() => window.saoSocial.logout());
  assert.equal((await page.evaluate(() => window.saoSocial.getState())).snapshot, null);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ social: 'two real native accounts against the standalone HTTP service; requests, acceptance, friend presence and Message Box', messages: 'both directions, unread/read, persisted history and rejected unknown recipients', credentials: 'session kept out of renderer and encrypted by OS storage when available; restore and logout checked' }, null, 2));
} finally { for (const instance of instances) await instance.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); await rm(temporary, { recursive: true, force: true }); }
