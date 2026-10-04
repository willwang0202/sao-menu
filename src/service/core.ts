import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { messageText, username, type SocialProfile, type SocialSnapshot } from '../shared/social';
import type { AccountStore, StoredProfile, StoredUser } from './store';

/** The account protocol spoken by the desktop app, independent of where data is stored. */
class ServiceError extends Error { constructor(readonly status: number, message: string) { super(message); } }

const MINUTE = 60_000;
const SESSION_LIFETIME = 30 * 24 * 60 * MINUTE;
const SESSIONS_KEPT = 4;
const ONLINE_WINDOW = MINUTE;
const MAX_BODY_BYTES = 16384;
const MAX_FRIENDSHIPS = 200;
const MESSAGE_HISTORY = 200;
const MAX_CONCURRENT_HASHES = 4;
const LIMITS = { request: 300, auth: 20, friend: 30, message: 60 } as const;
const TOKEN = /^Bearer ([a-zA-Z0-9_-]{43})$/;
/** Hashed for unknown usernames so failed logins take as long as real ones. */
const DUMMY_SALT = '0'.repeat(48);

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const profile = (user: SocialProfile): SocialProfile => ({ id: user.id, username: user.username, displayName: user.displayName });
const pairKey = (a: string, b: string) => [a, b].sort().join(':');
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

export function createAccountService(store: AccountStore) {
  let activeHashes = 0;
  const limit = async (key: string, maximum: number) => {
    if (!await store.hit(key, maximum, MINUTE, Date.now())) throw new ServiceError(429, 'Too many requests. Try again in a minute.');
  };
  const passwordHash = async (password: string, salt: string): Promise<Buffer> => {
    if (activeHashes >= MAX_CONCURRENT_HASHES) throw new ServiceError(429, 'The account service is busy. Try again shortly.');
    activeHashes++;
    try { return await new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))); }
    finally { activeHashes--; }
  };
  const requireFriend = async (user: string, peer: unknown): Promise<string> => {
    if (typeof peer !== 'string' || peer.length > 100 || !await store.areFriends(pairKey(user, peer))) throw new ServiceError(403, 'Direct messages require an accepted friend connection.');
    return peer;
  };
  const session = async (user: StoredUser) => {
    const token = randomBytes(32).toString('base64url'), now = Date.now();
    await store.createSession(hashToken(token), user.id, now + SESSION_LIFETIME, now, SESSIONS_KEPT);
    return { token, profile: profile(user) };
  };
  const snapshot = async (user: StoredUser): Promise<SocialSnapshot> => {
    const now = Date.now();
    const friendships = await store.friendships(user.id);
    const peer = (item: { from: StoredProfile; to: StoredProfile }) => item.from.id === user.id ? item.to : item.from;
    const friends = friendships.filter(item => item.status === 'accepted').map(item => ({ ...profile(peer(item)), online: now - peer(item).lastSeen < ONLINE_WINDOW }));
    const requests = friendships.filter(item => item.status === 'pending').map(item => ({ id: item.id, from: profile(item.from), to: profile(item.to), createdAt: item.createdAt }));
    const peers = new Map(friends.map(friend => [friend.id, profile(friend)]));
    const conversations = (await store.conversations(user.id))
      .filter(item => peers.has(item.peerId))
      .map(item => ({ peer: peers.get(item.peerId)!, lastMessage: item.lastMessage, unread: item.unread }))
      .sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);
    return { profile: profile(user), friends, requests, conversations };
  };

  async function readBody(request: Request): Promise<Record<string, unknown>> {
    if (request.method !== 'POST') {
      if (request.method !== 'GET') throw new ServiceError(405, 'Unsupported method.');
      return {};
    }
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ServiceError(415, 'Use JSON requests.');
    const text = await request.text();
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new ServiceError(413, 'Request is too large.');
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      return parsed;
    } catch { throw new ServiceError(400, 'Invalid request.'); }
  }

  async function authenticate(route: string, body: Record<string, unknown>, address: string): Promise<Response> {
    await limit(`auth:${address}`, LIMITS.auth);
    const name = username(body.username);
    if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) throw new ServiceError(400, 'Use a password of 12–128 characters.');
    if (route === '/v1/register') {
      if (typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.length > 40 || /[\u0000-\u001f\u007f]/.test(body.displayName)) throw new ServiceError(400, 'Enter a display name of 1–40 characters.');
      if (await store.findUserByName(name)) throw new ServiceError(409, 'That username is already taken.');
      const salt = randomBytes(24).toString('hex');
      const user: StoredUser = { id: randomUUID(), username: name, displayName: body.displayName.trim(), salt, password: (await passwordHash(body.password, salt)).toString('hex'), lastSeen: Date.now() };
      if (!await store.insertUser(user)) throw new ServiceError(409, 'That username is already taken.');
      return json(await session(user), 201);
    }
    const user = await store.findUserByName(name);
    const candidate = await passwordHash(body.password, user?.salt ?? DUMMY_SALT);
    if (!user || !timingSafeEqual(candidate, Buffer.from(user.password, 'hex'))) throw new ServiceError(401, 'The username or password is incorrect.');
    return json(await session(user));
  }

  async function signedIn(route: string, method: string, url: URL, body: Record<string, unknown>, user: StoredUser, token: string): Promise<Response> {
    if (route === '/v1/state' && method === 'GET') return json(await snapshot(user));
    if (route === '/v1/logout' && method === 'POST') { await store.deleteSession(hashToken(token)); return json({ ok: true }); }
    if (route === '/v1/friends/request' && method === 'POST') {
      await limit(`friend:${user.id}`, LIMITS.friend);
      const friend = await store.findUserByName(username(body.username));
      if (!friend || friend.id === user.id) throw new ServiceError(404, 'Choose another registered player.');
      if (await store.pairExists(pairKey(user.id, friend.id))) throw new ServiceError(409, 'A friend connection or request already exists.');
      if (await store.friendshipCount(user.id) >= MAX_FRIENDSHIPS || await store.friendshipCount(friend.id) >= MAX_FRIENDSHIPS) throw new ServiceError(409, 'The friend list is full.');
      if (!await store.insertFriendship({ id: randomUUID(), fromId: user.id, toId: friend.id, pairKey: pairKey(user.id, friend.id), createdAt: Date.now() })) throw new ServiceError(409, 'A friend connection or request already exists.');
      return json({ ok: true });
    }
    if (route === '/v1/friends/resolve' && method === 'POST') {
      if (typeof body.id !== 'string' || body.id.length > 100 || !['accept', 'decline'].includes(String(body.action))) throw new ServiceError(400, 'Choose Accept or Decline.');
      if (await store.pendingRecipient(body.id) !== user.id) throw new ServiceError(403, 'This request belongs to another player.');
      await (body.action === 'accept' ? store.acceptFriendship(body.id) : store.deleteFriendship(body.id));
      return json({ ok: true });
    }
    if (route === '/v1/friends/remove' && method === 'POST') {
      await store.deleteFriendshipPair(pairKey(user.id, await requireFriend(user.id, body.peer)));
      return json({ ok: true });
    }
    if (route === '/v1/messages' && method === 'GET') {
      return json({ messages: await store.messages(user.id, await requireFriend(user.id, url.searchParams.get('peer')), MESSAGE_HISTORY) });
    }
    if (route === '/v1/messages/send' && method === 'POST') {
      await limit(`message:${user.id}`, LIMITS.message);
      const peer = await requireFriend(user.id, body.peer), text = messageText(body.text);
      await store.insertMessage({ id: randomUUID(), from: user.id, to: peer, text, createdAt: Date.now(), readAt: null });
      return json({ ok: true }, 201);
    }
    if (route === '/v1/messages/read' && method === 'POST') {
      await store.markRead(await requireFriend(user.id, body.peer), user.id, Date.now());
      return json({ ok: true });
    }
    throw new ServiceError(404, 'Unknown account service operation.');
  }

  return {
    /** `address` identifies the client for rate limiting (its IP behind the deployment's proxy). */
    async handle(request: Request, address = 'local'): Promise<Response> {
      try {
        const url = new URL(request.url), route = url.pathname;
        if (route === '/health' && request.method === 'GET') return json({ status: 'ok', version: 1 });
        await limit(`request:${address}`, LIMITS.request);
        const body = await readBody(request);
        if (['/v1/register', '/v1/login'].includes(route) && request.method === 'POST') return await authenticate(route, body, address);
        const token = request.headers.get('authorization')?.match(TOKEN)?.[1];
        const user = token ? await store.sessionUser(hashToken(token), Date.now()) : null;
        if (!token || !user) throw new ServiceError(401, 'Sign in to your account.');
        await store.touchUser(user.id, Date.now());
        return await signedIn(route, request.method, url, body, user, token);
      } catch (error) {
        if (error instanceof ServiceError) return json({ error: error.message }, error.status);
        if (error instanceof Error && /^(Use |Enter )/.test(error.message)) return json({ error: error.message }, 400);
        // Server-side detail only; the client gets a generic message. Messages here never contain credentials.
        console.error('Account operation failed.', { method: request.method, route: new URL(request.url).pathname, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
        return json({ error: 'The account service could not complete this request.' }, 500);
      }
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
