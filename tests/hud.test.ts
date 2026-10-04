import test from 'node:test';
import assert from 'node:assert/strict';
import { hpBattery, hpState, hpHeight } from '../src/shared/hud';
import type { SocialSnapshot } from '../src/shared/social';

test('HP shows battery remaining and defaults to 100% without battery telemetry', () => {
  assert.equal(hpBattery(37), 37);
  for (const absent of [null, undefined, NaN, Infinity]) assert.equal(hpBattery(absent), 100);
  assert.equal(hpBattery(120), 100); assert.equal(hpBattery(-2), 0);
});
test('account name overrides local preferences; companions require accepted membership', () => {
  const own = { id: 'self', username: 'kirito', displayName: 'My account name' };
  const friend = { id: 'friend', username: 'asuna', displayName: 'A real friend', online: true, batteryPercent: 37 };
  const settings = { playerName: 'Old local name', reducedMotion: false, theme: 'sao' as const };
  const snapshot: SocialSnapshot = { profile: own, friends: [friend], requests: [], conversations: [], partyInvites: [{ id: 'invitation', partyId: 'party', from: friend, createdAt: 1 }] };
  assert.equal(hpState(settings, null, snapshot).playerName, own.displayName);
  assert.deepEqual(hpState(settings, null, snapshot).partyMembers, [], 'friends and invitations do not produce HP bars');
  snapshot.party = { id: 'party', leaderId: own.id, members: [{ ...own, online: true, batteryPercent: 100 }, friend] };
  assert.deepEqual(hpState(settings, null, snapshot).partyMembers, [friend], 'only companions, without duplicating the player');
  snapshot.party.members = [friend];
  assert.deepEqual(hpState(settings, null, snapshot).partyMembers, [], 'nonmembers cannot display another party');
  assert.equal(hpHeight(0), 62); assert.equal(hpHeight(1), 89); assert.equal(hpHeight(5), 257);
});

test('HP name boxes grow by measured text width while retaining original battery geometry', async () => {
  const { hpNameWidth, hpWidgetWidth } = await import('../src/shared/hud');
  assert.equal(hpNameWidth(28), 40);
  assert.equal(hpNameWidth(68.1), 77);
  assert.equal(hpWidgetWidth([68.1]), 395);
  assert.equal(hpWidgetWidth([28, 640]), 826);
  assert.equal(hpWidgetWidth([28]), 358);
});

test('HP level starts at one and counts complete days since account creation', async () => {
  const { hpLevel } = await import('../src/shared/hud');
  const created = Date.UTC(2026, 9, 3, 10);
  assert.equal(hpLevel(created, created), 1);
  assert.equal(hpLevel(created, created + 86400000 - 1), 1);
  assert.equal(hpLevel(created, created + 3 * 86400000), 4);
  assert.equal(hpLevel(created, created - 60000), 1);
  assert.equal(hpLevel(undefined, created), 1);
});
