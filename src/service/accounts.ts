import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { messageText, username, type DirectMessage, type SocialProfile, type SocialSnapshot } from '../shared/social';

class ServiceError extends Error { constructor(readonly status: number, message: string) { super(message); } }
interface User extends SocialProfile { password: string; salt: string; last_seen: number }
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const profile = (user: User): SocialProfile => ({ id: user.id, username: user.username, displayName: user.displayName });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

/** Standalone account service. The deployment terminates HTTPS in front of it. */
export function createSocialService(file: string) {
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE COLLATE NOCASE,displayName TEXT NOT NULL,password TEXT NOT NULL,salt TEXT NOT NULL,last_seen INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS friendships(id TEXT PRIMARY KEY,from_id TEXT NOT NULL REFERENCES users(id),to_id TEXT NOT NULL REFERENCES users(id),pair_key TEXT UNIQUE,status TEXT NOT NULL CHECK(status IN ('pending','accepted')),createdAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,"from" TEXT NOT NULL REFERENCES users(id),"to" TEXT NOT NULL REFERENCES users(id),text TEXT NOT NULL,createdAt INTEGER NOT NULL,readAt INTEGER);
    CREATE INDEX IF NOT EXISTS message_pair ON messages("from","to",createdAt);
    CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);
  `);
  let activeHashes = 0;
  const rates = new Map<string, { time: number; count: number }>();
  const limit = (key: string, maximum: number) => {
    const now = Date.now(); let entry = rates.get(key);
    if (!entry || now - entry.time >= 60000) { entry = { time: now, count: 0 }; rates.set(key, entry); }
    if (++entry.count > maximum) throw new ServiceError(429, 'Too many requests. Try again in a minute.');
    if (rates.size > 2000) for (const [key, entry] of rates) if (now - entry.time >= 60000) rates.delete(key);
    if (rates.size > 2000) throw new ServiceError(429, 'The account service is busy. Try again shortly.');
  };
  const passwordHash = async (password: string, salt: string): Promise<Buffer> => {
    if (activeHashes >= 4) throw new ServiceError(429, 'The account service is busy. Try again shortly.');
    activeHashes++;
    try { return await new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))); }
    finally { activeHashes--; }
  };
  const getUser = (id: string) => db.prepare('SELECT * FROM users WHERE id=?').get(id) as unknown as User | undefined;
  const pairKey = (a: string, b: string) => [a, b].sort().join(':');
  const requireFriend = (a: string, b: unknown): string => {
    if (typeof b !== 'string' || b.length > 100 || !db.prepare("SELECT id FROM friendships WHERE pair_key=? AND status='accepted'").get(pairKey(a, b))) throw new ServiceError(403, 'Direct messages require an accepted friend connection.');
    return b;
  };
  const session = (user: User) => {
    const token = randomBytes(32).toString('base64url'); const now = Date.now();
    db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
    db.prepare('DELETE FROM sessions WHERE user_id=? AND hash NOT IN (SELECT hash FROM sessions WHERE user_id=? ORDER BY expires DESC LIMIT 4)').run(user.id, user.id);
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hashToken(token), user.id, now + 30 * 86400000);
    return { token, profile: profile(user) };
  };
  const snapshot = (user: User): SocialSnapshot => {
    const friendships = db.prepare("SELECT * FROM friendships WHERE (from_id=? OR to_id=?) ORDER BY createdAt").all(user.id, user.id) as unknown as { id: string; from_id: string; to_id: string; status: string; createdAt: number }[];
    const friends = friendships.filter(item => item.status === 'accepted').map(item => { const friend = getUser(item.from_id === user.id ? item.to_id : item.from_id)!; return { ...profile(friend), online: Date.now() - friend.last_seen < 60000 }; });
    const requests = friendships.filter(item => item.status === 'pending').map(item => ({ id: item.id, from: profile(getUser(item.from_id)!), to: profile(getUser(item.to_id)!), createdAt: item.createdAt }));
    const conversations = friends.flatMap(peer => {
      const lastMessage = db.prepare('SELECT * FROM messages WHERE ("from"=? AND "to"=?) OR ("from"=? AND "to"=?) ORDER BY createdAt DESC,rowid DESC LIMIT 1').get(user.id, peer.id, peer.id, user.id) as unknown as DirectMessage | undefined;
      if (!lastMessage) return [];
      const unread = Number(db.prepare('SELECT COUNT(*) AS count FROM messages WHERE "from"=? AND "to"=? AND readAt IS NULL').get(peer.id, user.id)!.count);
      return [{ peer: profile(getUser(peer.id)!), lastMessage, unread }];
    }).sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);
    return { profile: profile(user), friends, requests, conversations };
  };
  return {
    close() { db.close(); },
    async handle(request: Request, address = 'local'): Promise<Response> {
      try {
        const url = new URL(request.url); const route = url.pathname;
        if (route === '/health' && request.method === 'GET') return json({ status: 'ok', version: 1 });
        limit(`request:${address}`, 300);
        let body: Record<string, unknown> = {};
        if (request.method === 'POST') {
          if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ServiceError(415, 'Use JSON requests.');
          const text = await request.text(); if (Buffer.byteLength(text) > 16384) throw new ServiceError(413, 'Request is too large.');
          try { const parsed = JSON.parse(text); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); body = parsed; } catch { throw new ServiceError(400, 'Invalid request.'); }
        } else if (request.method !== 'GET') throw new ServiceError(405, 'Unsupported method.');
        if (['/v1/register', '/v1/login'].includes(route) && request.method === 'POST') {
          limit(`auth:${address}`, 20); const name = username(body.username);
          if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) throw new ServiceError(400, 'Use a password of 12–128 characters.');
          if (route === '/v1/register') {
            if (typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.length > 40 || /[\u0000-\u001f\u007f]/.test(body.displayName)) throw new ServiceError(400, 'Enter a display name of 1–40 characters.');
            if (db.prepare('SELECT id FROM users WHERE username=?').get(name)) throw new ServiceError(409, 'That username is already taken.');
            const salt = randomBytes(24).toString('hex'); const password = (await passwordHash(body.password, salt)).toString('hex');
            const user: User = { id: randomUUID(), username: name, displayName: body.displayName.trim(), salt, password, last_seen: Date.now() };
            try { db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(user.id, user.username, user.displayName, password, salt, user.last_seen); }
            catch { throw new ServiceError(409, 'That username is already taken.'); }
            return json(session(user), 201);
          }
          const user = db.prepare('SELECT * FROM users WHERE username=?').get(name) as unknown as User | undefined;
          const candidate = await passwordHash(body.password, user?.salt ?? '000000000000000000000000000000000000000000000000');
          if (!user || !timingSafeEqual(candidate, Buffer.from(user.password, 'hex'))) throw new ServiceError(401, 'The username or password is incorrect.');
          return json(session(user));
        }
        const token = request.headers.get('authorization')?.match(/^Bearer ([a-zA-Z0-9_-]{43})$/)?.[1];
        const grant = token && db.prepare('SELECT user_id FROM sessions WHERE hash=? AND expires>?').get(hashToken(token), Date.now());
        if (!grant) throw new ServiceError(401, 'Sign in to your account.');
        const user = getUser(String(grant.user_id))!;
        db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(Date.now(), user.id);
        if (route === '/v1/state' && request.method === 'GET') return json(snapshot(user));
        if (route === '/v1/logout' && request.method === 'POST') { db.prepare('DELETE FROM sessions WHERE hash=?').run(hashToken(token!)); return json({ ok: true }); }
        if (route === '/v1/friends/request' && request.method === 'POST') {
          limit(`friend:${user.id}`, 30);
          const friend = db.prepare('SELECT * FROM users WHERE username=?').get(username(body.username)) as unknown as User | undefined;
          if (!friend || friend.id === user.id) throw new ServiceError(404, 'Choose another registered player.');
          if (db.prepare('SELECT id FROM friendships WHERE pair_key=?').get(pairKey(user.id, friend.id))) throw new ServiceError(409, 'A friend connection or request already exists.');
          if (Number(db.prepare('SELECT COUNT(*) AS count FROM friendships WHERE from_id=? OR to_id=?').get(user.id, user.id)!.count) >= 200 || Number(db.prepare('SELECT COUNT(*) AS count FROM friendships WHERE from_id=? OR to_id=?').get(friend.id, friend.id)!.count) >= 200) throw new ServiceError(409, 'The friend list is full.');
          db.prepare("INSERT INTO friendships VALUES(?,?,?,?,'pending',?)").run(randomUUID(), user.id, friend.id, pairKey(user.id, friend.id), Date.now());
          return json({ ok: true });
        }
        if (route === '/v1/friends/resolve' && request.method === 'POST') {
          if (typeof body.id !== 'string' || !['accept', 'decline'].includes(String(body.action))) throw new ServiceError(400, 'Choose Accept or Decline.');
          const pending = db.prepare("SELECT * FROM friendships WHERE id=? AND status='pending'").get(body.id);
          if (!pending || pending.to_id !== user.id) throw new ServiceError(403, 'This request belongs to another player.');
          if (body.action === 'accept') db.prepare("UPDATE friendships SET status='accepted' WHERE id=?").run(body.id);
          else db.prepare('DELETE FROM friendships WHERE id=?').run(body.id);
          return json({ ok: true });
        }
        if (route === '/v1/friends/remove' && request.method === 'POST') {
          const peer = requireFriend(user.id, body.peer);
          db.prepare('DELETE FROM friendships WHERE pair_key=?').run(pairKey(user.id, peer)); return json({ ok: true });
        }
        if (route === '/v1/messages' && request.method === 'GET') {
          const peer = requireFriend(user.id, url.searchParams.get('peer'));
          const messages = db.prepare('SELECT * FROM (SELECT * FROM messages WHERE ("from"=? AND "to"=?) OR ("from"=? AND "to"=?) ORDER BY createdAt DESC,rowid DESC LIMIT 200) ORDER BY createdAt').all(user.id, peer, peer, user.id);
          return json({ messages });
        }
        if (route === '/v1/messages/send' && request.method === 'POST') {
          limit(`message:${user.id}`, 60); const peer = requireFriend(user.id, body.peer); const text = messageText(body.text);
          db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,NULL)').run(randomUUID(), user.id, peer, text, Date.now()); return json({ ok: true }, 201);
        }
        if (route === '/v1/messages/read' && request.method === 'POST') {
          const peer = requireFriend(user.id, body.peer); db.prepare('UPDATE messages SET readAt=? WHERE "from"=? AND "to"=? AND readAt IS NULL').run(Date.now(), peer, user.id); return json({ ok: true });
        }
        throw new ServiceError(404, 'Unknown account service operation.');
      } catch (error) {
        if (error instanceof ServiceError) return json({ error: error.message }, error.status);
        if (error instanceof Error && /^(Use |Enter )/.test(error.message)) return json({ error: error.message }, 400);
        console.error('Account operation failed.', error instanceof Error ? error.name : 'Unknown error');
        return json({ error: 'The account service could not complete this request.' }, 500);
      }
    },
  };
}
