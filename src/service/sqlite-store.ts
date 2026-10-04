import { DatabaseSync } from 'node:sqlite';
import type { DirectMessage } from '../shared/social';
import type { AccountStore, StoredProfile, StoredUser } from './store';

/** Local SQLite storage; the schema is unchanged from earlier releases so existing data keeps working. */
const SCHEMA = `PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE COLLATE NOCASE,displayName TEXT NOT NULL,password TEXT NOT NULL,salt TEXT NOT NULL,last_seen INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS friendships(id TEXT PRIMARY KEY,from_id TEXT NOT NULL REFERENCES users(id),to_id TEXT NOT NULL REFERENCES users(id),pair_key TEXT UNIQUE,status TEXT NOT NULL CHECK(status IN ('pending','accepted')),createdAt INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,"from" TEXT NOT NULL REFERENCES users(id),"to" TEXT NOT NULL REFERENCES users(id),text TEXT NOT NULL,createdAt INTEGER NOT NULL,readAt INTEGER);
  CREATE INDEX IF NOT EXISTS message_pair ON messages("from","to",createdAt);
  CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);`;
/** In-memory rate windows are fine for one local process; bound them so a flood cannot grow memory. */
const MAX_RATE_KEYS = 2000;

type Row = Record<string, unknown>;
const user = (row: Row): StoredUser => ({ id: String(row.id), username: String(row.username), displayName: String(row.displayName), password: String(row.password), salt: String(row.salt), lastSeen: Number(row.last_seen) });
const player = (row: Row, prefix: string): StoredProfile => ({ id: String(row[`${prefix}_id`]), username: String(row[`${prefix}_username`]), displayName: String(row[`${prefix}_name`]), lastSeen: Number(row[`${prefix}_seen`]) });
const message = (row: Row): DirectMessage => ({ id: String(row.id), from: String(row.from), to: String(row.to), text: String(row.text), createdAt: Number(row.createdAt), readAt: row.readAt === null ? null : Number(row.readAt) });

export function createSqliteStore(file: string): AccountStore & { close(): void } {
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  const rates = new Map<string, { start: number; count: number }>();
  const one = (sql: string, ...params: (string | number | null)[]) => db.prepare(sql).get(...params) as Row | undefined;
  const all = (sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params) as Row[];
  const run = (sql: string, ...params: (string | number | null)[]) => db.prepare(sql).run(...params);
  return {
    close: () => db.close(),
    async findUserByName(name) { const row = one('SELECT * FROM users WHERE username=?', name); return row ? user(row) : null; },
    async insertUser(next) {
      try { run('INSERT INTO users VALUES(?,?,?,?,?,?)', next.id, next.username, next.displayName, next.password, next.salt, next.lastSeen); return true; }
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
}
