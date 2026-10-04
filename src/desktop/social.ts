import { safeStorage } from 'electron';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getSystemStats } from './system';
import { hpBattery } from '../shared/hud';
import { accountSessionMatchesService, DEFAULT_SERVICE_URL, messageText, serviceURL, username, type DirectMessage, type SocialSnapshot, type SocialState } from '../shared/social';

class AccountError extends Error { constructor(readonly status: number, message: string) { super(message); } }
export class SocialClient {
  private state: SocialState = { serviceURL: DEFAULT_SERVICE_URL, connected: false, error: '', snapshot: null };
  private token = '';
  private generation = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private writes: Promise<void> = Promise.resolve();
  private batteryReportedAt = 0;
  constructor(private readonly file: string, private readonly notify: (state: SocialState) => void, endpoint = DEFAULT_SERVICE_URL) {
    this.state.serviceURL = serviceURL(endpoint);
  }
  getState(): SocialState { return structuredClone(this.state); }
  async start(): Promise<void> {
    try {
      if ((await stat(this.file)).size > 16384) throw new Error();
      const saved = JSON.parse(await readFile(this.file, 'utf8'));
      if (!accountSessionMatchesService(serviceURL(saved.serviceURL), this.state.serviceURL)) throw new Error('Saved credentials belong to another service.');
      if (typeof saved.encryptedToken === 'string' && this.encryptionAvailable()) {
        const token = safeStorage.decryptString(Buffer.from(saved.encryptedToken, 'base64'));
        if (/^[a-zA-Z0-9_-]{43}$/.test(token)) this.token = token;
      }
    } catch { /* Absent or unreadable credentials require a new sign-in. */ }
    this.publish(); void this.refresh();
    this.timer = setInterval(() => { void this.refresh(); }, 5000); this.timer.unref();
  }
  stop(): void { if (this.timer) clearInterval(this.timer); }
  async authenticate(raw: unknown): Promise<void> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Enter your account details.');
    const input = raw as Record<string, unknown>;
    const address = this.state.serviceURL, name = username(input.username);
    if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128 || typeof input.register !== 'boolean') throw new Error('Use a password of 12–128 characters.');
    const result = await this.request(input.register ? 'register' : 'login', { username: name, password: input.password, displayName: input.displayName }, '', address) as { token: string };
    if (!/^[a-zA-Z0-9_-]{43}$/.test(result.token)) throw new Error('The account service returned an invalid session.');
    this.generation++; this.token = result.token; this.batteryReportedAt = 0; this.state = { serviceURL: address, connected: false, error: '', snapshot: null };
    await this.persist(); await this.refresh(true);
    if (!this.state.connected || !this.state.snapshot) throw new Error(this.state.error || 'The account session could not be verified. Try signing in again.');
  }
  async logout(): Promise<void> {
    const address = this.state.serviceURL, token = this.token;
    this.generation++; this.token = ''; this.state = { serviceURL: address, connected: false, error: '', snapshot: null }; this.publish();
    await this.persist();
    if (token) await this.request('logout', {}, token, address);
  }
  async requestFriend(value: unknown): Promise<void> { await this.request('friends/request', { username: username(value) }); await this.refresh(true); }
  async resolveRequest(id: unknown, action: unknown): Promise<void> {
    if (typeof id !== 'string' || id.length > 100 || !['accept', 'decline'].includes(String(action))) throw new Error('Choose an incoming friend request.');
    await this.request('friends/resolve', { id, action }); await this.refresh(true);
  }
  async removeFriend(id: unknown): Promise<void> { await this.request('friends/remove', { peer: this.peer(id) }); await this.refresh(true); }
  async inviteParty(peer: unknown): Promise<void> { await this.request('party/invite', { peer: this.peer(peer) }); await this.refresh(true); }
  async resolveParty(id: unknown, action: unknown): Promise<void> {
    if (typeof id !== 'string' || !this.state.snapshot?.partyInvites?.some(invite => invite.id === id) || !['accept', 'decline'].includes(String(action))) throw new Error('Choose an incoming party invitation.');
    await this.request('party/resolve', { id, action }); await this.refresh(true);
  }
  async leaveParty(): Promise<void> { await this.request('party/leave', {}); await this.refresh(true); }
  async getMessages(peer: unknown): Promise<DirectMessage[]> {
    const result = await this.request(`messages?peer=${encodeURIComponent(this.peer(peer))}`) as { messages: DirectMessage[] };
    if (!Array.isArray(result.messages) || result.messages.length > 200 || result.messages.some(message => typeof message.text !== 'string' || message.text.length > 4000 || typeof message.id !== 'string' || typeof message.from !== 'string' || typeof message.to !== 'string' || !Number.isFinite(message.createdAt))) throw new Error('The service returned an invalid conversation.');
    return result.messages;
  }
  async sendMessage(peer: unknown, text: unknown): Promise<void> { await this.request('messages/send', { peer: this.peer(peer), text: messageText(text) }); await this.refresh(true); }
  async markRead(peer: unknown): Promise<void> { await this.request('messages/read', { peer: this.peer(peer) }); await this.refresh(true); }
  private peer(value: unknown): string {
    if (typeof value !== 'string' || !this.state.snapshot?.friends.some(friend => friend.id === value)) throw new Error('Choose a player from your friend list.');
    return value;
  }
  private async refresh(force = false): Promise<void> {
    if (!this.token || this.polling && !force) return;
    const generation = this.generation; this.polling = true;
    try {
      if (Date.now() - this.batteryReportedAt >= 30_000) {
        const stats = await getSystemStats();
        if (generation !== this.generation) return;
        await this.request('presence', { batteryPercent: hpBattery(stats.batteryPercent) });
        this.batteryReportedAt = Date.now();
      }
      const snapshot = await this.request('state') as SocialSnapshot;
      if (generation !== this.generation) return;
      if (!snapshot?.profile?.id || !Array.isArray(snapshot.friends) || snapshot.friends.length > 200 || !Array.isArray(snapshot.requests) || snapshot.requests.length > 200 || !Array.isArray(snapshot.conversations) || snapshot.conversations.length > 200) throw new Error('The account service returned an invalid friend list.');
      this.state.snapshot = snapshot; this.state.connected = true; this.state.error = '';
    } catch (error) {
      if (generation !== this.generation) return;
      this.state.connected = false; this.state.error = error instanceof Error ? error.message : 'Account service is unavailable.';
      if (error instanceof AccountError && error.status === 401) { this.token = ''; this.state.snapshot = null; await this.persist(); }
    } finally { this.polling = false; if (generation === this.generation) this.publish(); }
  }
  private async request(route: string, body?: unknown, token = this.token, address = this.state.serviceURL): Promise<unknown> {
    const response = await fetch(`${address}/v1/${route}`, { method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(8000), headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const reader = response.body?.getReader(); let text = '', size = 0;
    if (reader) {
      const decoder = new TextDecoder();
      while (true) { const chunk = await reader.read(); if (chunk.done) { text += decoder.decode(); break; } size += chunk.value.byteLength; if (size > 1024 * 1024) { await reader.cancel(); throw new Error('The account response is too large.'); } text += decoder.decode(chunk.value, { stream: true }); }
    }
    let result: any;
    try { result = JSON.parse(text); } catch { throw new Error('This address did not return a compatible SAO account service.'); }
    if (!response.ok) throw new AccountError(response.status, typeof result.error === 'string' ? result.error.slice(0, 300) : 'The account service rejected this request.');
    return result;
  }
  private encryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text');
  }
  private async persist(): Promise<void> {
    const saved: { serviceURL: string; encryptedToken?: string } = { serviceURL: this.state.serviceURL };
    try { if (this.token && this.encryptionAvailable()) saved.encryptedToken = safeStorage.encryptString(this.token).toString('base64'); } catch { /* Keep the session in memory, never persist plaintext credentials. */ }
    const write = this.writes.then(async () => { await mkdir(path.dirname(this.file), { recursive: true }); const temporary = `${this.file}.${process.pid}.tmp`; await writeFile(temporary, JSON.stringify(saved), { mode: 0o600 }); await rename(temporary, this.file); });
    this.writes = write.catch(() => {}); await write;
  }
  private publish(): void { this.notify(this.getState()); }
}
