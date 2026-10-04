import { DatabaseSync } from 'node:sqlite';
import type { DirectMessage } from '../shared/social';
import type { AccountStore, StoredProfile, StoredUser } from './store';
import { partyStore, type QueryClient, type TransactionClient } from './party-store';

/** Additive migrations preserve existing local accounts and sessions. */
const SCHEMA = `PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE COLLATE NOCASE,displayName TEXT NOT NULL,password TEXT NOT NULL,salt TEXT NOT NULL,last_seen INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS friendships(id TEXT PRIMARY KEY,from_id TEXT NOT NULL REFERENCES users(id),to_id TEXT NOT NULL REFERENCES users(id),pair_key TEXT UNIQUE,status TEXT NOT NULL CHECK(status IN ('pending','accepted')),createdAt INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,"from" TEXT NOT NULL REFERENCES users(id),"to" TEXT NOT NULL REFERENCES users(id),text TEXT NOT NULL,createdAt INTEGER NOT NULL,readAt INTEGER);
  CREATE INDEX IF NOT EXISTS message_pair ON messages("from","to",createdAt);
  CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);`;
const PARTY_SCHEMA = `
  CREATE TABLE IF NOT EXISTS parties(id TEXT PRIMARY KEY,leader_id TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS party_members(user_id TEXT PRIMARY KEY REFERENCES users(id),party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,joined_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS party_member_party ON party_members(party_id);
  CREATE TABLE IF NOT EXISTS party_invites(id TEXT PRIMARY KEY,party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,from_id TEXT NOT NULL REFERENCES users(id),to_id TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,UNIQUE(party_id,to_id));
  CREATE INDEX IF NOT EXISTS party_invite_recipient ON party_invites(to_id);
  CREATE INDEX IF NOT EXISTS party_invite_sender ON party_invites(from_id);`;
/** In-memory rate windows are fine for one local process; bound them so a flood cannot grow memory. */
const MAX_RATE_KEYS = 2000;

type Row = Record<string, unknown>;
const user = (row: Row): StoredUser => ({ id: String(row.id), username: String(row.username), displayName: String(row.displayName), password: String(row.password), salt: String(row.salt), lastSeen: Number(row.last_seen), createdAt: Number(row.created_at) });
const player = (row: Row, prefix: string): StoredProfile => ({ id: String(row[`${prefix}_id`]), username: String(row[`${prefix}_username`]), displayName: String(row[`${prefix}_name`]), lastSeen: Number(row[`${prefix}_seen`]) });
const message = (row: Row): DirectMessage => ({ id: String(row.id), from: String(row.from), to: String(row.to), text: String(row.text), createdAt: Number(row.createdAt), readAt: row.readAt === null ? null : Number(row.readAt) });

export function createSqliteStore(file: string): AccountStore & { close(): void } {
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  if (!(db.prepare('PRAGMA table_info(users)').all() as Row[]).some(row => row.name === 'battery_percent')) db.exec('ALTER TABLE users ADD COLUMN battery_percent INTEGER NOT NULL DEFAULT 100 CHECK(battery_percent BETWEEN 0 AND 100)');
  if (!(db.prepare('PRAGMA table_info(users)').all() as Row[]).some(row => row.name === 'created_at')) {
    db.exec('ALTER TABLE users ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0');
    db.prepare('UPDATE users SET created_at=?').run(Date.now());
  }
  db.exec(PARTY_SCHEMA);
  const rates = new Map<string, { start: number; count: number }>();
  const one = (sql: string, ...params: (string | number | null)[]) => db.prepare(sql).get(...params) as Row | undefined;
  const all = (sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params) as Row[];
  const run = (sql: string, ...params: (string | number | null)[]) => db.prepare(sql).run(...params);
  const query: QueryClient['query'] = async (text, params = []) => {
    const values: (string | number | null)[] = [];
    const statement = text.replace(/sao\./g, '').replace(/display_name/g, 'displayName').replace(/ FOR UPDATE/g, '').replace(/\$(\d+)/g, (_, n) => { values.push(params[Number(n) - 1] as string | number | null); return '?'; });
    return all(statement, ...values);
  };
  const sql: TransactionClient = { query, transaction: async work => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = await work({ query }); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } };
  const store: AccountStore = {
    ...partyStore(sql),
    async findUserByName(name) { const row = one('SELECT * FROM users WHERE username=?', name); return row ? user(row) : null; },
    async insertUser(next) {
      try { run('INSERT INTO users(id,username,displayName,password,salt,last_seen,created_at) VALUES(?,?,?,?,?,?,?)', next.id, next.username, next.displayName, next.password, next.salt, next.lastSeen, next.createdAt ?? next.lastSeen); return true; }
      catch { return false; }
    },
    async touchUser(id, now) { run('UPDATE users SET last_seen=? WHERE id=?', now, id); },
    async createSession(hash, userId, expires, now, keep) {
      run('DELETE FROM sessions WHERE expires<?', now);
      run('DELETE FROM sessions WHERE user_id=? AND hash NOT IN (SELECT hash FROM sessions WHERE user_id=? ORDER BY expires DESC LIMIT ?)', userId, userId, keep);
      run('INSERT INTO sessions VALUES(?,?,?)', hash, userId, expires);
    },
    async sessionUser(hash, now) {
      const row = one('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE hash=? AND expires>?', hash, now);
      return row ? user(row) : null;
    },
    async deleteSession(hash) { run('DELETE FROM sessions WHERE hash=?', hash); },
    async friendships(userId) {
      return all(`SELECT f.id,f.status,f.createdAt,a.id AS from_id,a.username AS from_username,a.displayName AS from_name,a.last_seen AS from_seen,
          b.id AS to_id,b.username AS to_username,b.displayName AS to_name,b.last_seen AS to_seen
        FROM friendships f JOIN users a ON a.id=f.from_id JOIN users b ON b.id=f.to_id
        WHERE f.from_id=? OR f.to_id=? ORDER BY f.createdAt`, userId, userId)
        .map(row => ({ id: String(row.id), status: row.status === 'accepted' ? 'accepted' : 'pending', createdAt: Number(row.createdAt), from: player(row, 'from'), to: player(row, 'to') }));
    },
    async pairExists(key) { return !!one('SELECT id FROM friendships WHERE pair_key=?', key); },
    async areFriends(key) { return !!one("SELECT id FROM friendships WHERE pair_key=? AND status='accepted'", key); },
    async friendshipCount(userId) { return Number(one('SELECT COUNT(*) AS count FROM friendships WHERE from_id=? OR to_id=?', userId, userId)!.count); },
    async insertFriendship(input) {
      try { run("INSERT INTO friendships VALUES(?,?,?,?,'pending',?)", input.id, input.fromId, input.toId, input.pairKey, input.createdAt); return true; }
      catch { return false; }
    },
    async pendingRecipient(id) { const row = one("SELECT to_id FROM friendships WHERE id=? AND status='pending'", id); return row ? String(row.to_id) : null; },
    async acceptFriendship(id) { run("UPDATE friendships SET status='accepted' WHERE id=?", id); },
    async deleteFriendship(id) { run('DELETE FROM friendships WHERE id=?', id); },
    async deleteFriendshipPair(key) { run('DELETE FROM friendships WHERE pair_key=?', key); },
    async conversations(userId) {
      const peers = all("SELECT CASE WHEN from_id=? THEN to_id ELSE from_id END AS peer FROM friendships WHERE status='accepted' AND (from_id=? OR to_id=?)", userId, userId, userId).map(row => String(row.peer));
      return peers.flatMap(peer => {
        const last = one('SELECT * FROM messages WHERE ("from"=? AND "to"=?) OR ("from"=? AND "to"=?) ORDER BY createdAt DESC,rowid DESC LIMIT 1', userId, peer, peer, userId);
        if (!last) return [];
        const unread = Number(one('SELECT COUNT(*) AS count FROM messages WHERE "from"=? AND "to"=? AND readAt IS NULL', peer, userId)!.count);
        return [{ peerId: peer, lastMessage: message(last), unread }];
      });
    },
    async messages(a, b, limit) {
      return all('SELECT * FROM (SELECT *,rowid AS position FROM messages WHERE ("from"=? AND "to"=?) OR ("from"=? AND "to"=?) ORDER BY createdAt DESC,rowid DESC LIMIT ?) ORDER BY createdAt,position', a, b, b, a, limit).map(message);
    },
    async insertMessage(next) { run('INSERT INTO messages VALUES(?,?,?,?,?,NULL)', next.id, next.from, next.to, next.text, next.createdAt); },
    async markRead(from, to, now) { run('UPDATE messages SET readAt=? WHERE "from"=? AND "to"=? AND readAt IS NULL', now, from, to); },
    async hit(key, maximum, windowMs, now) {
      let entry = rates.get(key);
      if (!entry || now - entry.start >= windowMs) { entry = { start: now, count: 0 }; rates.set(key, entry); }
      entry.count++;
      if (rates.size > MAX_RATE_KEYS) for (const [stale, value] of rates) if (now - value.start >= windowMs) rates.delete(stale);
      return entry.count <= maximum && rates.size <= MAX_RATE_KEYS;
    },
  };
  // A single SQLite connection must not interleave requests inside a party transaction.
  let pending: Promise<unknown> = Promise.resolve();
  const serialized = Object.fromEntries(Object.entries(store).map(([name, method]) => [name, (...args: unknown[]) => {
    const result = pending.then(() => Reflect.apply(method, store, args));
    pending = result.catch(() => {}); return result;
  }])) as unknown as AccountStore;
  return { ...serialized, close: () => db.close() };
}
