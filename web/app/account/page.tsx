import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { DirectMessage, SocialSnapshot } from '../../../src/shared/social';
import { callAccount, sessionToken } from '@/lib/session';
import { logout, resolveRequest } from '../actions';
import { AddFriendForm, AutoRefresh, MarkRead, SendMessageForm } from './forms';
import './account.css';

export const metadata: Metadata = { title: 'Account' };

const time = (value: number) => new Date(value).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ peer?: string }> }) {
  const token = await sessionToken();
  if (!token) redirect('/login');
  const state = await callAccount<SocialSnapshot>('state', undefined, token);
  if (!state.ok) redirect(state.status === 401 ? '/session/end' : '/login');
  const { profile, friends, requests, conversations } = state.data;
  const { peer } = await searchParams;
  const selected = friends.find(friend => friend.id === peer) ?? null;
  const thread = selected ? await callAccount<{ messages: DirectMessage[] }>(`messages?peer=${encodeURIComponent(selected.id)}`, undefined, token) : null;
  const incoming = requests.filter(request => request.to.id === profile.id);
  const outgoing = requests.filter(request => request.from.id === profile.id);
  const unread = new Map(conversations.map(item => [item.peer.id, item.unread]));

  return (
    <div className="account">
      <AutoRefresh />
      <aside className="info-panel" aria-label="Player">
        <p className="section-label">Player</p>
        <h1 className="player-name">{profile.displayName}</h1>
        <p className="player-handle">@{profile.username}</p>
        <p className="player-status"><span className="presence online" aria-hidden="true" />Online</p>
        <form action={logout}><button className="quiet-button" type="submit">Log out</button></form>
      </aside>

      <section className="panel" aria-labelledby="friends-title">
        <h2 id="friends-title" className="panel-title">Friends <span>{friends.length}</span></h2>
        <AddFriendForm />
        {incoming.length > 0 && (
          <ul className="request-list" aria-label="Friend requests">
            {incoming.map(request => (
              <li key={request.id} className="request-row">
                <span><strong>{request.from.displayName}</strong> wants to be friends</span>
                <form action={resolveRequest} className="request-actions">
                  <input type="hidden" name="id" value={request.id} />
                  <button className="pill selected" name="action" value="accept" type="submit">YES</button>
                  <button className="pill" name="action" value="decline" type="submit">NO</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {friends.length === 0 ? <p className="empty">No friends yet. Send a request by account name; they accept it in the app or here.</p> : (
          <ul className="friend-list">
            {friends.map(friend => (
              <li key={friend.id}>
                <Link href={`/account?peer=${friend.id}`} className="friend-row" aria-current={friend.id === selected?.id ? 'page' : undefined}>
                  <span className={`presence ${friend.online ? 'online' : ''}`} aria-label={friend.online ? 'Online' : 'Offline'} />
                  <span className="friend-name">{friend.displayName}<small>@{friend.username}</small></span>
                  {(unread.get(friend.id) ?? 0) > 0 && <span className="badge">{unread.get(friend.id)}<span className="visually-hidden"> unread</span></span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {outgoing.length > 0 && <p className="empty">Waiting for {outgoing.map(request => request.to.displayName).join(', ')}.</p>}
      </section>

      <section className="panel thread" aria-labelledby="thread-title">
        {selected && thread?.ok ? (
          <>
            <h2 id="thread-title" className="panel-title">{selected.displayName}</h2>
            {(unread.get(selected.id) ?? 0) > 0 && <MarkRead peer={selected.id} />}
            <ol className="messages">
              {thread.data.messages.length === 0 && <li className="empty">No messages yet.</li>}
              {thread.data.messages.map(message => (
                <li key={message.id} className={message.from === profile.id ? 'mine' : 'theirs'}>
                  <p>{message.text}</p><time dateTime={new Date(message.createdAt).toISOString()}>{time(message.createdAt)}</time>
                </li>
              ))}
            </ol>
            <SendMessageForm peer={selected.id} />
          </>
        ) : (
          <>
            <h2 id="thread-title" className="panel-title">Messages</h2>
            <p className="empty">Choose a friend to open your conversation.</p>
          </>
        )}
      </section>
    </div>
  );
}
