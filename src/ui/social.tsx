import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DirectMessage, SocialAPI, SocialProfile, SocialState } from '../shared/social';
import './social.css';

const empty: SocialState = { serviceURL: '', connected: false, error: '', snapshot: null };
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

export function SocialPanel({ mode, y, onPress }: { mode: 'friends' | 'messages'; y: number; onPress: () => void }) {
  const api = window.saoSocial;
  const [state, setState] = useState(empty);
  const [tab, setTab] = useState<'friends' | 'requests' | 'party'>('friends');
  const [peer, setPeer] = useState<SocialProfile | null>(null);
  const [chat, setChat] = useState(false);
  const [player, setPlayer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!api) return;
    let active = true;
    const detach = api.onState(next => { if (active) setState(next); });
    void api.getState().then(next => { if (active) setState(next); }).catch(e => active && setError(errorText(e)));
    return () => { active = false; detach(); };
  }, [api]);
  useEffect(() => { setPeer(null); setChat(false); setError(''); setNotice(''); }, [mode, state.snapshot?.profile.id]);
  useEffect(() => { if (peer && !state.snapshot?.friends.some(friend => friend.id === peer.id)) { setPeer(null); setChat(false); } }, [state.snapshot, peer]);
  const run = async (action: () => Promise<void>, done?: () => void) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice(''); onPress();
    try { await action(); done?.(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const snapshot = state.snapshot;
  return <section className="social-panel" style={{ left: 345, top: y }} role="region" aria-label={mode === 'friends' ? 'Social' : 'Direct messages'}>
    {!api ? <div className="social-paper"><h2>{mode === 'friends' ? 'Social' : 'Message Box'}</h2><p>Open the desktop application to connect your online account.</p></div> : !snapshot ? <AccountForm api={api} state={state} onPress={onPress} /> : <>
      <div className="social-list">
        <header><h2>{mode === 'friends' ? 'Friend List' : 'Message Box'}</h2><span>{snapshot.profile.displayName}</span></header>
        {mode === 'friends' && <nav aria-label="Social lists"><button className={tab === 'friends' ? 'active' : ''} onClick={() => { setTab('friends'); onPress(); }}>Friends</button><button className={tab === 'requests' ? 'active' : ''} onClick={() => { setTab('requests'); onPress(); }}>Friend Requests ({snapshot.requests.length})</button><button className={tab === 'party' ? 'active' : ''} onClick={() => { setTab('party'); setPeer(null); setChat(false); onPress(); }}>Party ({snapshot.party?.members.length ?? 0}){(snapshot.partyInvites?.length ?? 0) > 0 ? ` · ${snapshot.partyInvites!.length} invite` : ''}</button></nav>}
        <div className="social-rows">
          {mode === 'friends' && tab === 'party' ? <>
            {snapshot.party?.members.map(member => <div className="friend-request" key={member.id}><strong>{member.displayName}</strong><span>@{member.username} · {member.id === snapshot.party?.leaderId ? 'Leader' : 'Member'} · {member.online ? 'Online' : 'Offline'}</span></div>)}
            {!snapshot.party && <p className="social-empty">Invite a friend to form a party. Companion HP bars appear after they accept.</p>}
            {snapshot.party && <button className="social-action" disabled={busy || !state.connected} onClick={() => void run(() => api.leaveParty())}>Leave party</button>}
            {(snapshot.partyInvites ?? []).map(invite => <div className="friend-request" key={invite.id}><strong>{invite.from.displayName}</strong><span>Party invitation</span><div><button className="social-action" aria-label={`Join ${invite.from.displayName}'s party`} disabled={busy || !state.connected} onClick={() => void run(() => api.resolveParty(invite.id, 'accept'))}>Join party</button><button className="social-action" aria-label={`Decline ${invite.from.displayName}'s party`} disabled={busy || !state.connected} onClick={() => void run(() => api.resolveParty(invite.id, 'decline'))}>Decline</button></div></div>)}
          </> : mode === 'friends' && tab === 'requests' ? <>
            {snapshot.requests.map(request => {
              const incoming = request.to.id === snapshot.profile.id, other = incoming ? request.from : request.to;
              return <div className="friend-request" key={request.id}><strong>{other.displayName}</strong><span>@{other.username} · {incoming ? 'Incoming' : 'Pending'}</span>{incoming && <div><button className="social-action" aria-label={`Accept ${other.displayName}`} disabled={busy || !state.connected} onClick={() => void run(() => api.resolveRequest(request.id, 'accept'))}>Accept</button><button className="social-action" aria-label={`Decline ${other.displayName}`} disabled={busy || !state.connected} onClick={() => void run(() => api.resolveRequest(request.id, 'decline'))}>Decline</button></div>}</div>;
            })}
            {!snapshot.requests.length && <p className="social-empty">No friend requests.</p>}
          </> : <>
            {snapshot.friends.map(friend => {
              const conversation = snapshot.conversations.find(item => item.peer.id === friend.id);
              return <button className={`friend-ribbon ${peer?.id === friend.id ? 'selected' : ''}`} key={friend.id} onClick={() => { setPeer(friend); setChat(mode === 'messages'); onPress(); }} aria-label={mode === 'messages' && conversation?.unread ? `${friend.displayName}, ${conversation.unread} unread` : friend.displayName}><img src={`./sao-original/Images/symbol/${mode === 'friends' ? 'party' : 'msg'}${peer?.id === friend.id ? '-hovered' : ''}.png`} alt="" /><span>{friend.displayName}<small>{mode === 'messages' ? conversation?.lastMessage.text ?? 'Open Message Box' : state.connected && friend.online ? 'Online' : 'Offline'}</small></span>{mode === 'messages' && !!conversation?.unread && <b>{conversation.unread}</b>}</button>;
            })}
            {!snapshot.friends.length && <p className="social-empty">{mode === 'friends' ? 'Your friend list is empty.' : 'Add a friend in Social to start a direct message.'}</p>}
          </>}
        </div>
        {mode === 'friends' && tab !== 'party' && <form className="friend-add" onSubmit={event => { event.preventDefault(); void run(() => api.requestFriend(player), () => { setPlayer(''); setNotice('Friend request sent.'); }); }}><label>Player username<input value={player} onChange={event => setPlayer(event.target.value)} minLength={3} maxLength={32} required autoCapitalize="none" spellCheck={false} /></label><button className="social-action" disabled={busy || !state.connected}>Send friend request</button></form>}
        <footer><span role="status">{state.connected ? 'Connected' : 'Reconnecting…'}</span><button disabled={busy} onClick={() => void run(() => api.logout())}>Sign out</button></footer>
      </div>
      {peer ? chat ? <MessageBox key={peer.id} api={api} peer={peer} ownId={snapshot.profile.id} connected={state.connected} onBack={() => { if (mode === 'friends') setChat(false); else setPeer(null); onPress(); }} onPress={onPress} /> : <div className="social-paper friend-profile"><h2>Profile</h2><img src="./sao-original/Images/symbol/party.png" alt="" /><h3>{peer.displayName}</h3><p>@{peer.username}</p><button className="social-action" onClick={() => { setChat(true); onPress(); }}>Message Box</button><button className="social-action" disabled={busy || !state.connected} onClick={() => void run(() => api.removeFriend(peer.id))}>Remove friend</button><button className="social-action" disabled={busy || !state.connected || snapshot.party?.members.some(member => member.id === peer.id)} onClick={() => void run(() => api.inviteParty(peer.id), () => setNotice('Party invitation sent.'))}>{snapshot.party?.members.some(member => member.id === peer.id) ? 'In your party' : 'Invite to party'}</button></div> : <div className="social-paper social-instruction"><h2>{mode === 'friends' ? 'Social' : 'Message Box'}</h2><img src={`./sao-original/Images/symbol/${mode === 'friends' ? 'party' : 'msg'}.png`} alt="" /><p>{mode === 'friends' ? 'Choose a friend to open their profile or Message Box.' : 'Choose a friend to read and send direct messages.'}</p></div>}
    </>}
    {(error || state.error) && snapshot && <p className="social-error" role="alert">{error || state.error}</p>}
    {notice && <p className="social-notice" role="status">{notice}</p>}
  </section>;
}

function AccountForm({ api, state, onPress }: { api: SocialAPI; state: SocialState; onPress: () => void }) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="social-paper account-paper"><h2>Social · Online account</h2><nav aria-label="Account"><button className={!register ? 'active' : ''} onClick={() => { setRegister(false); setError(''); onPress(); }}>Sign in</button><button className={register ? 'active' : ''} onClick={() => { setRegister(true); setError(''); onPress(); }}>Create account</button></nav><form onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); onPress();
    try { await api.authenticate({ username: name, password, displayName, register }); setPassword(''); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }}><label>Username<input value={name} onChange={event => setName(event.target.value)} minLength={3} maxLength={32} required autoComplete="username" autoCapitalize="none" spellCheck={false} /></label>{register && <label>Display name<input value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={40} required /></label>}<label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} maxLength={128} required autoComplete={register ? 'new-password' : 'current-password'} /></label><p className="account-hint">Your SAO Menu account connects your friends and messages across devices.</p><button className="social-action" disabled={busy}>{busy ? 'Connecting…' : register ? 'Register' : 'Connect'}</button>{(error || state.error) && <p className="form-error" role="alert">{error || state.error}</p>}</form></div>;
}

function MessageBox({ api, peer, ownId, connected, onBack, onPress }: { api: SocialAPI; peer: SocialProfile; ownId: string; connected: boolean; onBack: () => void; onPress: () => void }) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const history = useRef<HTMLDivElement>(null);
  const active = useRef(true);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    try {
      const next = await api.getMessages(peer.id);
      if (!active.current || sequence !== request.current) return;
      setMessages(next); setLoaded(true); setError('');
      if (next.some(item => item.to === ownId && item.readAt === null)) await api.markRead(peer.id);
    } catch (e) { if (active.current && sequence === request.current) setError(errorText(e)); }
  }, [api, peer.id, ownId]);
  useEffect(() => { active.current = true; void refresh(); const timer = setInterval(() => void refresh(), 3000); return () => { active.current = false; request.current++; clearInterval(timer); }; }, [refresh]);
  useEffect(() => { const element = history.current; if (element) element.scrollTop = element.scrollHeight; }, [messages.length]);
  return <div className="social-paper message-paper"><header><h2>Message Box</h2><button onClick={onBack} aria-label="Back to friend list">‹</button></header><h3>{peer.displayName} <small>@{peer.username}</small></h3><div className="message-history" ref={history} role="log" aria-label={`Messages with ${peer.displayName}`} aria-live="polite">
    {messages.map(item => <article className={item.from === ownId ? 'outgoing' : 'incoming'} key={item.id}><header><strong>{item.from === ownId ? 'You' : peer.displayName}</strong><time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></header><p>{item.text}</p></article>)}
    {!messages.length && <p className="social-empty">{loaded ? 'No messages yet.' : 'Loading messages…'}</p>}
  </div><form onSubmit={async event => {
    event.preventDefault(); if (sending || !draft.trim()) return;
    setSending(true); setError(''); onPress();
    try { await api.sendMessage(peer.id, draft); if (active.current) { setDraft(''); await refresh(); } } catch (e) { if (active.current) setError(errorText(e)); } finally { if (active.current) setSending(false); }
  }}><label>Direct message<textarea value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} rows={3} required /></label><button className="social-action" disabled={sending || !connected || !draft.trim()}>{sending ? 'Sending…' : 'Send message'}</button></form>{error && <p role="alert" className="form-error">{error}</p>}</div>;
}
