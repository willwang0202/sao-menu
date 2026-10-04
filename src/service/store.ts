import type { DirectMessage, SocialProfile } from '../shared/social';

/** Storage behind the account protocol. Implementations: SQLite (local/desktop) and Postgres (Supabase). */
export interface StoredUser extends SocialProfile { password: string; salt: string; lastSeen: number }
export interface StoredProfile extends SocialProfile { lastSeen: number }
export interface StoredFriendship { id: string; status: 'pending' | 'accepted'; createdAt: number; from: StoredProfile; to: StoredProfile }
export interface StoredConversation { peerId: string; lastMessage: DirectMessage; unread: number }

export interface AccountStore {
  findUserByName(name: string): Promise<StoredUser | null>;
  /** Returns false when the (lower-case) username is already taken. */
  insertUser(user: StoredUser): Promise<boolean>;
  touchUser(id: string, now: number): Promise<void>;
  /** Stores a session and prunes expired ones and all but the user's newest `keep`. */
  createSession(hash: string, userId: string, expires: number, now: number, keep: number): Promise<void>;
  sessionUser(hash: string, now: number): Promise<StoredUser | null>;
  deleteSession(hash: string): Promise<void>;
  /** The user's friendships, oldest first, with both players' profiles. */
  friendships(userId: string): Promise<StoredFriendship[]>;
  pairExists(pairKey: string): Promise<boolean>;
  areFriends(pairKey: string): Promise<boolean>;
  friendshipCount(userId: string): Promise<number>;
  /** Returns false when the pair already has a friendship or request. */
  insertFriendship(input: { id: string; fromId: string; toId: string; pairKey: string; createdAt: number }): Promise<boolean>;
  pendingRecipient(id: string): Promise<string | null>;
  acceptFriendship(id: string): Promise<void>;
  deleteFriendship(id: string): Promise<void>;
  deleteFriendshipPair(pairKey: string): Promise<void>;
  /** Latest message and unread count for each accepted friend with history. */
  conversations(userId: string): Promise<StoredConversation[]>;
  /** The newest `limit` messages between two players, oldest first. */
  messages(a: string, b: string, limit: number): Promise<DirectMessage[]>;
  insertMessage(message: DirectMessage): Promise<void>;
  markRead(from: string, to: string, now: number): Promise<void>;
  /** Counts a request against `key` in a fixed window; false once `maximum` is exceeded. */
  hit(key: string, maximum: number, windowMs: number, now: number): Promise<boolean>;
}
