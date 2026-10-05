import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationPosition, invitationText, pendingInvitation } from '../src/shared/invitations';
import type { SocialSnapshot } from '../src/shared/social';

const me = { id: 'me', username: 'kirito', displayName: 'Kirito' };
const asuna = { id: 'asuna', username: 'asuna', displayName: 'Asuna' };
const klein = { id: 'klein', username: 'klein', displayName: 'Klein' };
const snapshot = (change: Partial<SocialSnapshot> = {}): SocialSnapshot => ({ profile: me, friends: [], requests: [], conversations: [], party: null, partyInvites: [], ...change });

test('returns null when nothing awaits an answer', () => {
  assert.equal(pendingInvitation(null), null);
  assert.equal(pendingInvitation(snapshot()), null);
});

test('ignores friend requests the player sent', () => {
  assert.equal(pendingInvitation(snapshot({ requests: [{ id: 'r1', from: me, to: asuna, createdAt: 1 }] })), null);
});

test('offers the oldest incoming invitation first', () => {
  const pending = pendingInvitation(snapshot({
    requests: [{ id: 'r1', from: klein, to: me, createdAt: 20 }],
    partyInvites: [{ id: 'p1', partyId: 'party', from: asuna, createdAt: 10 }],
  }));
  assert.deepEqual(pending, { kind: 'party', id: 'p1', from: 'Asuna', createdAt: 10 });
});

test('offers an incoming friend request', () => {
  assert.deepEqual(pendingInvitation(snapshot({ requests: [{ id: 'r1', from: klein, to: me, createdAt: 5 }] })), { kind: 'friend', id: 'r1', from: 'Klein', createdAt: 5 });
});

test('words the dialog for each invitation kind', () => {
  assert.equal(invitationText({ kind: 'party', id: 'p1', from: 'Asuna', createdAt: 0 }), 'Asuna has invited you to a party.');
  assert.equal(invitationText({ kind: 'friend', id: 'r1', from: 'Klein', createdAt: 0 }), 'Klein has sent you a friend request.');
});

test('centres the invitation window in the work area', () => {
  assert.deepEqual(invitationPosition({ x: 0, y: 25, width: 1920, height: 1050 }), { x: 750, y: 400 });
});
