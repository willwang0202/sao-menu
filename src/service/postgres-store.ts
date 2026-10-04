import type { DirectMessage } from '../shared/social';
import type { AccountStore, StoredProfile, StoredUser } from './store';
import { partyStore, type TransactionClient } from './party-store';

/**
 * Postgres storage (Supabase in production) over the `sao` schema in
 * web/supabase/migrations. Every statement is parameterized.
 */
export interface SqlClient extends TransactionClient {}

/** Rate-limit rows older than this are pruned when sessions are created. */
const RATE_ROW_RETENTION = 24 * 60 * 60 * 1000;

type Row = Record<string, unknown>;
// bigint columns arrive as strings from some drivers; normalize to numbers.
const num = (value: unknown) => Number(value);
const user = (row: Row): StoredUser => ({ id: String(row.id), username: String(row.username), displayName: String(row.display_name), password: String(row.password), salt: String(row.salt), lastSeen: num(row.last_seen), createdAt: num(row.created_at) });
const player = (row: Row, prefix: string): StoredProfile => ({ id: String(row[`${prefix}_id`]), username: String(row[`${prefix}_username`]), displayName: String(row[`${prefix}_name`]), lastSeen: num(row[`${prefix}_seen`]) });
const message = (row: Row): DirectMessage => ({ id: String(row.id), from: String(row.from_id), to: String(row.to_id), text: String(row.text), createdAt: num(row.created_at), readAt: row.read_at === null ? null : num(row.read_at) });

export function createPostgresStore(sql: SqlClient): AccountStore {
  const one = async (text: string, params: unknown[]) => (await sql.query(text, params))[0];
  return {
    ...partyStore(sql),
    async findUserByName(name) { const row = await one('SELECT * FROM sao.users WHERE username=$1', [name]); return row ? user(row) : null; },
    async insertUser(next) {
      const rows = await sql.query('INSERT INTO sao.users(id,username,display_name,password,salt,last_seen,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (username) DO NOTHING RETURNING id',
        [next.id, next.username, next.displayName, next.password, next.salt, next.lastSeen, next.createdAt ?? next.lastSeen]);
      return rows.length === 1;
    },
    async touchUser(id, now) { await sql.query('UPDATE sao.users SET last_seen=$2 WHERE id=$1', [id, now]); },
    async createSession(hash, userId, expires, now, keep) {
      await sql.query('DELETE FROM sao.sessions WHERE expires<$1', [now]);
      await sql.query('DELETE FROM sao.rate_limits WHERE window_start<$1', [now - RATE_ROW_RETENTION]);
      await sql.query('DELETE FROM sao.sessions WHERE user_id=$1 AND hash NOT IN (SELECT hash FROM sao.sessions WHERE user_id=$1 ORDER BY expires DESC LIMIT $2)', [userId, keep]);
      await sql.query('INSERT INTO sao.sessions(hash,user_id,expires) VALUES($1,$2,$3)', [hash, userId, expires]);
    },
    async sessionUser(hash, now) {
      const row = await one('SELECT u.* FROM sao.sessions s JOIN sao.users u ON u.id=s.user_id WHERE s.hash=$1 AND s.expires>$2', [hash, now]);
      return row ? user(row) : null;
    },
    async deleteSession(hash) { await sql.query('DELETE FROM sao.sessions WHERE hash=$1', [hash]); },
    async friendships(userId) {
      const rows = await sql.query(`SELECT f.id,f.status,f.created_at,
          a.id AS from_id,a.username AS from_username,a.display_name AS from_name,a.last_seen AS from_seen,
          b.id AS to_id,b.username AS to_username,b.display_name AS to_name,b.last_seen AS to_seen
        FROM sao.friendships f JOIN sao.users a ON a.id=f.from_id JOIN sao.users b ON b.id=f.to_id
        WHERE f.from_id=$1 OR f.to_id=$1 ORDER BY f.created_at`, [userId]);
      return rows.map(row => ({ id: String(row.id), status: row.status === 'accepted' ? 'accepted' : 'pending', createdAt: num(row.created_at), from: player(row, 'from'), to: player(row, 'to') }));
    },
    async pairExists(key) { return !!await one('SELECT 1 FROM sao.friendships WHERE pair_key=$1', [key]); },
    async areFriends(key) { return !!await one("SELECT 1 FROM sao.friendships WHERE pair_key=$1 AND status='accepted'", [key]); },
    async friendshipCount(userId) { return num((await one('SELECT count(*) AS n FROM sao.friendships WHERE from_id=$1 OR to_id=$1', [userId]))!.n); },
    async insertFriendship(input) {
      const rows = await sql.query("INSERT INTO sao.friendships(id,from_id,to_id,pair_key,status,created_at) VALUES($1,$2,$3,$4,'pending',$5) ON CONFLICT (pair_key) DO NOTHING RETURNING id",
        [input.id, input.fromId, input.toId, input.pairKey, input.createdAt]);
      return rows.length === 1;
    },
    async pendingRecipient(id) { const row = await one("SELECT to_id FROM sao.friendships WHERE id=$1 AND status='pending'", [id]); return row ? String(row.to_id) : null; },
    async acceptFriendship(id) { await sql.query("UPDATE sao.friendships SET status='accepted' WHERE id=$1", [id]); },
    async deleteFriendship(id) { await sql.query('DELETE FROM sao.friendships WHERE id=$1', [id]); },
    async deleteFriendshipPair(key) { await sql.query('DELETE FROM sao.friendships WHERE pair_key=$1', [key]); },
    async conversations(userId) {
      // One round trip: each accepted friend's latest message plus the unread count.
      const rows = await sql.query(`SELECT p.peer, m.*,
          (SELECT count(*) FROM sao.messages u WHERE u.from_id=p.peer AND u.to_id=$1 AND u.read_at IS NULL) AS unread
        FROM (SELECT CASE WHEN from_id=$1 THEN to_id ELSE from_id END AS peer FROM sao.friendships
              WHERE status='accepted' AND (from_id=$1 OR to_id=$1)) p
        JOIN LATERAL (SELECT * FROM sao.messages x WHERE (x.from_id=$1 AND x.to_id=p.peer) OR (x.from_id=p.peer AND x.to_id=$1)
                      ORDER BY x.created_at DESC, x.seq DESC LIMIT 1) m ON true`, [userId]);
      return rows.map(row => ({ peerId: String(row.peer), lastMessage: message(row), unread: num(row.unread) }));
    },
    async messages(a, b, limit) {
      const rows = await sql.query(`SELECT * FROM (SELECT * FROM sao.messages WHERE (from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1)
          ORDER BY created_at DESC, seq DESC LIMIT $3) recent ORDER BY created_at, seq`, [a, b, limit]);
      return rows.map(message);
    },
    async insertMessage(next) {
      await sql.query('INSERT INTO sao.messages(id,from_id,to_id,text,created_at) VALUES($1,$2,$3,$4,$5)', [next.id, next.from, next.to, next.text, next.createdAt]);
    },
    async markRead(from, to, now) { await sql.query('UPDATE sao.messages SET read_at=$3 WHERE from_id=$1 AND to_id=$2 AND read_at IS NULL', [from, to, now]); },
    async hit(key, maximum, windowMs, now) {
      // Atomic upsert so concurrent serverless instances share one counter per window.
      const row = await one(`INSERT INTO sao.rate_limits(key,window_start,count) VALUES($1,$2,1)
        ON CONFLICT (key) DO UPDATE SET
          count = CASE WHEN sao.rate_limits.window_start <= $2 - $3 THEN 1 ELSE sao.rate_limits.count + 1 END,
          window_start = CASE WHEN sao.rate_limits.window_start <= $2 - $3 THEN $2 ELSE sao.rate_limits.window_start END
        RETURNING count`, [key, now, windowMs]);
      return num(row!.count) <= maximum;
    },
  };
}
