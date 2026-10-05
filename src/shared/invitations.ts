import type { Position } from './contracts';
import type { SocialSnapshot } from './social';
import type { WorkArea } from './widgets';

/** An incoming invitation that the SAO alert window asks the player to accept (○) or decline (✕). */
export interface Invitation { kind: 'party' | 'friend'; id: string; from: string; createdAt: number }
export type InvitationAnswer = 'accept' | 'decline';
export const isInvitationAnswer = (value: unknown): value is InvitationAnswer => value === 'accept' || value === 'decline';

/** SAO_UI-Window drawn at 420px wide (1305×932 artwork). */
export const INVITATION_SIZE = { width: 420, height: 300 } as const;

/** The oldest party invitation or incoming friend request, or null. */
export function pendingInvitation(snapshot: SocialSnapshot | null): Invitation | null {
  if (!snapshot) return null;
  const parties: Invitation[] = (snapshot.partyInvites ?? []).map(invite => ({ kind: 'party', id: invite.id, from: invite.from.displayName, createdAt: invite.createdAt }));
  const friends: Invitation[] = snapshot.requests.filter(request => request.to.id === snapshot.profile.id)
    .map(request => ({ kind: 'friend', id: request.id, from: request.from.displayName, createdAt: request.createdAt }));
  return [...parties, ...friends].sort((a, b) => a.createdAt - b.createdAt)[0] ?? null;
}

export function invitationText(invitation: Invitation): string {
  return invitation.kind === 'party' ? `${invitation.from} has invited you to a party.` : `${invitation.from} has sent you a friend request.`;
}

export function invitationPosition(area: WorkArea): Position {
  return { x: area.x + Math.round((area.width - INVITATION_SIZE.width) / 2), y: area.y + Math.round((area.height - INVITATION_SIZE.height) / 2) };
}
