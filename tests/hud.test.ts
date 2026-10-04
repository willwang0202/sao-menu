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
  const settings = { playerName: 'Old local name', reducedMotion: false };
  const snapshot: SocialSnapshot = { profile: own, friends: [friend], requests: [], conversations: [], partyInvites: [{ id: 'invitation', partyId: 'party', from: friend, createdAt: 1 }] };
  assert.equal(hpState(settings, null, snapshot).playerName, own.displayName);
  assert.deepEqual(hpState(settings, null, snapshot).partyMembers, [], 'friends and invitations do not produce HP bars');
  snapshot.party = { id: 'party', leaderId: own.id, members: [{ ...own, online: true, batteryPercent: 100 }, friend] };
  assert.deepEqual(hpState(settings, null, snapshot).partyMembers, [friend], 'only companions, without duplicating the player');
  snapshot.party.members = [friend];
  assert.deepEqual(hpState(settings, null, snapshot).partyMembers, [], 'nonmembers cannot display another party');
  assert.equal(hpHeight(0), 62); assert.equal(hpHeight(1), 89); assert.equal(hpHeight(5), 257);
});
