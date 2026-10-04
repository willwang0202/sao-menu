import assert from 'node:assert/strict';

export async function runPartyCapacityScenario(handle: (request: Request) => Promise<Response>) {
  const call = async (route: string, token?: string, body?: unknown) => {
    const response = await handle(new Request(`http://localhost/v1/${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }));
    return { status: response.status, data: await response.json() as any };
  };
  const players = [];
  for (let i = 0; i < 7; i++) {
    const registered = await call('register', undefined, { username: `player_${i}`, displayName: `Player ${i}`, password: 'a party capacity password' });
    assert.equal(registered.status, 201); players.push(registered.data);
  }
  const leader = players[0];
  const invites: { token: string; id: string }[] = [];
  for (const player of players.slice(1)) {
    await call('friends/request', leader.token, { username: player.profile.username });
    const request = (await call('state', player.token)).data.requests[0];
    await call('friends/resolve', player.token, { id: request.id, action: 'accept' });
    assert.equal((await call('party/invite', leader.token, { peer: player.profile.id })).status, 200);
    invites.push({ token: player.token, id: (await call('state', player.token)).data.partyInvites[0].id });
  }
  for (const invite of invites.slice(0, 4)) assert.equal((await call('party/resolve', invite.token, { id: invite.id, action: 'accept' })).status, 200);
  const attempts = await Promise.all(invites.slice(4).map(invite => call('party/resolve', invite.token, { id: invite.id, action: 'accept' })));
  assert.deepEqual(attempts.map(result => result.status).sort(), [200, 409], 'simultaneous acceptances cannot overfill the party');
  assert.equal((await call('state', leader.token)).data.party.members.length, 6);
}
