import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import * as accounts from '../src/service/accounts';
import { accountServiceEndpoint, accountSessionMatchesService, DEFAULT_SERVICE_URL, serviceURL } from '../src/shared/social';
import { runAccountScenario } from './fixtures/account-scenario';
import { runPartyCapacityScenario } from './fixtures/party-scenario';

test('the online service requires HTTPS outside loopback development', () => {
  assert.equal(serviceURL('https://social.example.com/'), 'https://social.example.com');
  assert.equal(serviceURL('http://127.0.0.1:3210'), 'http://127.0.0.1:3210');
  for (const url of ['http://example.com', 'file:///x', 'https://user:pass@example.com', 'https://example.com/?token=abc']) assert.throws(() => serviceURL(url));
});

test('new installs use the hosted account service at sao-menu.favioon.com', () => {
  assert.equal(DEFAULT_SERVICE_URL, 'https://sao-menu.favioon.com');
  assert.equal(serviceURL(DEFAULT_SERVICE_URL), DEFAULT_SERVICE_URL, 'the default passes the HTTPS validation');
});
test('packaged clients pin production; only development tests can select a loopback service', () => {
  assert.equal(accountServiceEndpoint(true, 'https://foreign.example'), DEFAULT_SERVICE_URL);
  assert.equal(accountServiceEndpoint(true, 'http://127.0.0.1:3000'), DEFAULT_SERVICE_URL);
  assert.equal(accountServiceEndpoint(false), DEFAULT_SERVICE_URL);
  assert.equal(accountServiceEndpoint(false, 'http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
  assert.throws(() => accountServiceEndpoint(false, 'https://foreign.example'));
  assert.equal(accountSessionMatchesService('https://sao.favioon.com'), true);
  assert.equal(accountSessionMatchesService('https://foreign.example'), false);
});

test('real accounts require mutual friendship for DMs, preserve history and revoke sessions', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'sao-account-test-'));
  let service = accounts.createSocialService(path.join(folder, 'accounts.sqlite'));
  try {
    await runAccountScenario(request => service.handle(request), async () => {
      service.close(); service = accounts.createSocialService(path.join(folder, 'accounts.sqlite'));
      return request => service.handle(request);
    });
  } finally { service.close(); await rm(folder, { recursive: true, force: true }); }
});
test('SQLite party capacity stays at six under concurrent acceptances', async () => {
  const service = accounts.createSocialService(':memory:');
  try { await runPartyCapacityScenario(request => service.handle(request)); }
  finally { service.close(); }
});
