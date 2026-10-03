export interface SocialProfile { id: string; username: string; displayName: string }
export interface SocialFriend extends SocialProfile { online: boolean }
export interface FriendRequest { id: string; from: SocialProfile; to: SocialProfile; createdAt: number }
export interface DirectMessage { id: string; from: string; to: string; text: string; createdAt: number; readAt: number | null }
export interface SocialSnapshot { profile: SocialProfile; friends: SocialFriend[]; requests: FriendRequest[]; conversations: { peer: SocialProfile; lastMessage: DirectMessage; unread: number }[] }
export interface SocialState { serviceURL: string; connected: boolean; error: string; snapshot: SocialSnapshot | null }
export interface SocialAPI {
  getState(): Promise<SocialState>;
  authenticate(input: { serviceURL: string; username: string; password: string; displayName: string; register: boolean }): Promise<void>;
  logout(): Promise<void>;
  requestFriend(username: string): Promise<void>;
  resolveRequest(id: string, action: 'accept' | 'decline'): Promise<void>;
  removeFriend(id: string): Promise<void>;
  getMessages(peer: string): Promise<DirectMessage[]>;
  sendMessage(peer: string, text: string): Promise<void>;
  markRead(peer: string): Promise<void>;
  onState(callback: (state: SocialState) => void): () => void;
}
export function serviceURL(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) throw new Error('Enter the HTTPS account service address.');
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('The account service requires HTTPS. Localhost is allowed for development.');
  return url.href.replace(/\/$/, '');
}
export function username(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_]{3,32}$/.test(value)) throw new Error('Use 3–32 letters, numbers or underscores for your username.');
  return value.toLowerCase();
}
export function messageText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error('Enter a message of 1–4000 characters.');
  return value.trim();
}
declare global { interface Window { saoSocial?: SocialAPI } }
