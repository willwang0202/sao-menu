import { PartyError, type AccountStore, type StoredProfile } from './store';

type Row = Record<string, unknown>;
export interface QueryClient { query(text: string, params?: readonly unknown[]): Promise<Row[]> }
export interface TransactionClient extends QueryClient { transaction<T>(work: (client: QueryClient) => Promise<T>): Promise<T> }
const profile = (row: Row): StoredProfile => ({ id: String(row.id), username: String(row.username), displayName: String(row.name), lastSeen: Number(row.last_seen) });
const key = (a: string, b: string) => [a, b].sort().join(':');
const one = async (sql: QueryClient, text: string, params: unknown[]) => (await sql.query(text, params))[0];
const lockPlayer = (sql: QueryClient, id: string) => sql.query('SELECT id FROM sao.users WHERE id=$1 FOR UPDATE', [id]);
const membership = (sql: QueryClient, id: string) => one(sql, 'SELECT party_id FROM sao.party_members WHERE user_id=$1', [id]);
async function requireFriend(sql: QueryClient, a: string, b: string) {
  if (a === b || !await one(sql, "SELECT id FROM sao.friendships WHERE pair_key=$1 AND status='accepted'", [key(a, b)])) throw new PartyError(403, 'Party invitations require an accepted friend connection.');
}
async function room(sql: QueryClient, id: string) {
  if (Number((await one(sql, 'SELECT count(*) AS n FROM sao.party_members WHERE party_id=$1', [id])).n) >= 6) throw new PartyError(409, 'The party is full (six players).');
}

/** Both stores use the same membership rules inside a database transaction. */
export function partyStore(sql: TransactionClient): Pick<AccountStore, 'setBattery' | 'party' | 'partyInvites' | 'inviteParty' | 'resolveParty' | 'leaveParty'> {
  return {
    async setBattery(id, percent) { await sql.query('UPDATE sao.users SET battery_percent=$2 WHERE id=$1', [id, percent]); },
    async party(id) {
      const party = await one(sql, 'SELECT p.id,p.leader_id FROM sao.parties p JOIN sao.party_members m ON m.party_id=p.id WHERE m.user_id=$1', [id]);
      if (!party) return null;
      const rows = await sql.query('SELECT u.id,u.username,u.display_name AS name,u.last_seen,u.battery_percent FROM sao.party_members m JOIN sao.users u ON u.id=m.user_id WHERE m.party_id=$1 ORDER BY m.joined_at,u.id', [party.id]);
      return { id: String(party.id), leaderId: String(party.leader_id), members: rows.map(row => ({ ...profile(row), batteryPercent: Number(row.battery_percent) })) };
    },
    async partyInvites(id) {
      const rows = await sql.query('SELECT i.id AS invite_id,i.party_id,i.created_at,u.id,u.username,u.display_name AS name,u.last_seen FROM sao.party_invites i JOIN sao.users u ON u.id=i.from_id WHERE i.to_id=$1 ORDER BY i.created_at', [id]);
      return rows.map(row => ({ id: String(row.invite_id), partyId: String(row.party_id), from: profile(row), createdAt: Number(row.created_at) }));
    },
    async inviteParty(input) {
      await sql.transaction(async tx => {
        await lockPlayer(tx, input.from); await requireFriend(tx, input.from, input.to);
        if (await membership(tx, input.to)) throw new PartyError(409, 'That player is already in a party.');
        const member = await membership(tx, input.from), id = member ? String(member.party_id) : input.partyId;
        if (!member) {
          await tx.query('INSERT INTO sao.parties(id,leader_id,created_at) VALUES($1,$2,$3)', [id, input.from, input.now]);
          await tx.query('INSERT INTO sao.party_members(user_id,party_id,joined_at) VALUES($1,$2,$3)', [input.from, id, input.now]);
        } else await tx.query('SELECT id FROM sao.parties WHERE id=$1 FOR UPDATE', [id]);
        await room(tx, id);
        const inserted = await tx.query('INSERT INTO sao.party_invites(id,party_id,from_id,to_id,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT (party_id,to_id) DO NOTHING RETURNING id', [input.inviteId, id, input.from, input.to, input.now]);
        if (!inserted.length) throw new PartyError(409, 'A party invitation is already pending.');
      });
    },
    async resolveParty(userId, inviteId, accept, now) {
      await sql.transaction(async tx => {
        await lockPlayer(tx, userId);
        const invite = await one(tx, 'SELECT party_id,from_id FROM sao.party_invites WHERE id=$1 AND to_id=$2', [inviteId, userId]);
        if (!invite) throw new PartyError(403, 'Choose one of your incoming party invitations.');
        const party = await one(tx, 'SELECT id FROM sao.parties WHERE id=$1 FOR UPDATE', [invite.party_id]);
        if (!party || !await one(tx, 'SELECT id FROM sao.party_invites WHERE id=$1 AND to_id=$2', [inviteId, userId])) throw new PartyError(409, 'That party invitation is no longer available.');
        if (accept) {
          if (await membership(tx, userId)) throw new PartyError(409, 'Leave your current party before joining another.');
          await requireFriend(tx, userId, String(invite.from_id)); await room(tx, String(invite.party_id));
          await tx.query('INSERT INTO sao.party_members(user_id,party_id,joined_at) VALUES($1,$2,$3)', [userId, invite.party_id, now]);
          await tx.query('DELETE FROM sao.party_invites WHERE to_id=$1', [userId]);
        } else await tx.query('DELETE FROM sao.party_invites WHERE id=$1', [inviteId]);
      });
    },
    async leaveParty(userId) {
      await sql.transaction(async tx => {
        await lockPlayer(tx, userId); const member = await membership(tx, userId); if (!member) return;
        const party = await one(tx, 'SELECT leader_id FROM sao.parties WHERE id=$1 FOR UPDATE', [member.party_id]);
        await tx.query('DELETE FROM sao.party_members WHERE user_id=$1', [userId]);
        await tx.query('DELETE FROM sao.party_invites WHERE party_id=$1 AND from_id=$2', [member.party_id, userId]);
        const next = await one(tx, 'SELECT user_id FROM sao.party_members WHERE party_id=$1 ORDER BY joined_at,user_id LIMIT 1', [member.party_id]);
        if (!next) await tx.query('DELETE FROM sao.parties WHERE id=$1', [member.party_id]);
        else if (party.leader_id === userId) await tx.query('UPDATE sao.parties SET leader_id=$2 WHERE id=$1', [member.party_id, next.user_id]);
      });
    },
  };
}
