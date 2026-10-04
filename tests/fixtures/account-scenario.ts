import assert from 'node:assert/strict';

type Handle = (request: Request) => Promise<Response>;

/**
 * The account protocol the desktop app relies on, run against any store implementation.
 * `reopen` swaps in a fresh service over the same data, proving persistence.
 */
export async function runAccountScenario(initial: Handle, reopen?: () => Promise<Handle>) {
  let handle = initial;
  const call = async (route: string, body?: unknown, token?: string) => {
    const response = await handle(new Request(`http://localhost/v1/${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }));
    return { status: response.status, data: await response.json() as any };
  };
  const kirito = await call('register', { username: 'kirito', displayName: 'Kirito', password: 'a long test password' });
  const asuna = await call('register', { username: 'asuna', displayName: 'Asuna', password: 'another long test password' });
  const outsider = await call('register', { username: 'outsider', displayName: 'Outsider', password: 'an outsider password' });
  assert.equal(kirito.status, 201); assert.equal(asuna.status, 201);
  assert.match(kirito.data.token, /^[a-zA-Z0-9_-]{43}$/);
  assert.equal((await call('login', { username: 'KIRITO', password: 'a long test password' })).status, 200, 'usernames are case-insensitive');
  assert.equal((await call('login', { username: 'kirito', password: 'wrong password here' })).status, 401);
  assert.equal((await call('register', { username: 'Kirito', displayName: 'Spoof', password: 'yet another password' })).status, 409);
  assert.equal((await call('state')).status, 401);
  assert.equal((await call('messages/send', { peer: asuna.data.profile.id, text: 'Before friendship' }, kirito.data.token)).status, 403);
  assert.equal((await call('friends/request', { username: 'asuna' }, kirito.data.token)).status, 200);
  assert.equal((await call('friends/request', { username: 'kirito' }, asuna.data.token)).status, 409, 'one request per pair');
  const pending = (await call('state', undefined, asuna.data.token)).data.requests[0];
  assert.equal(pending.from.username, 'kirito');
  assert.equal((await call('friends/resolve', { id: pending.id, action: 'accept' }, outsider.data.token)).status, 403);
  assert.equal((await call('friends/resolve', { id: pending.id, action: 'accept' }, asuna.data.token)).status, 200);
  const kiritoState = (await call('state', undefined, kirito.data.token)).data;
  assert.equal(kiritoState.friends[0].username, 'asuna');
  assert.equal(kiritoState.friends[0].online, true);
  assert.equal((await call('messages/send', { peer: asuna.data.profile.id, text: 'Meet at the teleport gate.' }, kirito.data.token)).status, 201);
  const unread = (await call('state', undefined, asuna.data.token)).data.conversations[0];
  assert.equal(unread.unread, 1); assert.equal(unread.lastMessage.text, 'Meet at the teleport gate.');
  assert.equal(unread.peer.username, 'kirito');
  const messages = await call(`messages?peer=${kirito.data.profile.id}`, undefined, asuna.data.token);
  assert.equal(messages.data.messages.length, 1);
  assert.equal(typeof messages.data.messages[0].createdAt, 'number');
  assert.equal(messages.data.messages[0].readAt, null);
  assert.equal((await call(`messages?peer=${kirito.data.profile.id}`, undefined, outsider.data.token)).status, 403);
  await call('messages/read', { peer: kirito.data.profile.id }, asuna.data.token);
  assert.equal((await call('state', undefined, asuna.data.token)).data.conversations[0].unread, 0);
  if (reopen) handle = await reopen();
  assert.equal((await call(`messages?peer=${kirito.data.profile.id}`, undefined, asuna.data.token)).data.messages[0].text, 'Meet at the teleport gate.');
  await call('friends/remove', { peer: kirito.data.profile.id }, asuna.data.token);
  assert.equal((await call('messages/send', { peer: asuna.data.profile.id, text: 'After removal' }, kirito.data.token)).status, 403);
  await call('logout', {}, kirito.data.token);
  assert.equal((await call('state', undefined, kirito.data.token)).status, 401);
}
