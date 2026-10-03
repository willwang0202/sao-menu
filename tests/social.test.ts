import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import * as accounts from '../src/service/accounts';
import { serviceURL } from '../src/shared/social';

test('the online service requires HTTPS outside loopback development', () => {
  assert.equal(serviceURL('https://social.example.com/'), 'https://social.example.com');
  assert.equal(serviceURL('http://127.0.0.1:3210'), 'http://127.0.0.1:3210');
  for (const url of ['http://example.com', 'file:///x', 'https://user:pass@example.com', 'https://example.com/?token=abc']) assert.throws(() => serviceURL(url));
});

test('real accounts require mutual friendship for DMs, preserve history and revoke sessions', async () => {
  assert.equal(typeof accounts.createSocialService, 'function');
  const folder = await mkdtemp(path.join(tmpdir(), 'sao-account-test-'));
  let service = accounts.createSocialService(path.join(folder, 'accounts.sqlite'));
  try {
    const call = async (route: string, body?: unknown, token?: string) => {
      const response = await service.handle(new Request(`http://localhost/v1/${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }));
      return { status: response.status, data: await response.json() as any };
    };
    const kirito = await call('register', { username: 'kirito', displayName: 'Kirito', password: 'a long test password' });
    const asuna = await call('register', { username: 'asuna', displayName: 'Asuna', password: 'another long test password' });
    const outsider = await call('register', { username: 'outsider', displayName: 'Outsider', password: 'an outsider password' });
    assert.equal(kirito.status, 201); assert.equal(asuna.status, 201);
    assert.equal((await call('login', { username: 'kirito', password: 'wrong password here' })).status, 401);
    assert.equal((await call('register', { username: 'kirito', displayName: 'Spoof', password: 'yet another password' })).status, 409);
    assert.equal((await call('state')).status, 401);
    assert.equal((await call('messages/send', { peer: asuna.data.profile.id, text: 'Before friendship' }, kirito.data.token)).status, 403);
    assert.equal((await call('friends/request', { username: 'asuna' }, kirito.data.token)).status, 200);
    const pending = (await call('state', undefined, asuna.data.token)).data.requests[0];
    assert.equal(pending.from.username, 'kirito');
    assert.equal((await call('friends/resolve', { id: pending.id, action: 'accept' }, outsider.data.token)).status, 403);
    assert.equal((await call('friends/resolve', { id: pending.id, action: 'accept' }, asuna.data.token)).status, 200);
    assert.equal((await call('state', undefined, kirito.data.token)).data.friends[0].username, 'asuna');
    assert.equal((await call('messages/send', { peer: asuna.data.profile.id, text: 'Meet at the teleport gate.' }, kirito.data.token)).status, 201);
    const unread = (await call('state', undefined, asuna.data.token)).data.conversations[0];
    assert.equal(unread.unread, 1); assert.equal(unread.lastMessage.text, 'Meet at the teleport gate.');
    const messages = await call(`messages?peer=${kirito.data.profile.id}`, undefined, asuna.data.token);
    assert.equal(messages.data.messages.length, 1);
    assert.equal((await call(`messages?peer=${kirito.data.profile.id}`, undefined, outsider.data.token)).status, 403);
    await call('messages/read', { peer: kirito.data.profile.id }, asuna.data.token);
    assert.equal((await call('state', undefined, asuna.data.token)).data.conversations[0].unread, 0);
    service.close(); service = accounts.createSocialService(path.join(folder, 'accounts.sqlite'));
    assert.equal((await call(`messages?peer=${kirito.data.profile.id}`, undefined, asuna.data.token)).data.messages[0].text, 'Meet at the teleport gate.');
    await call('friends/remove', { peer: kirito.data.profile.id }, asuna.data.token);
    assert.equal((await call('messages/send', { peer: asuna.data.profile.id, text: 'After removal' }, kirito.data.token)).status, 403);
    await call('logout', {}, kirito.data.token);
    assert.equal((await call('state', undefined, kirito.data.token)).status, 401);
  } finally { service.close(); await rm(folder, { recursive: true, force: true }); }
});
