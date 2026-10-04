'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { markRead, requestFriend, sendMessage } from '../actions';

/** Friends' presence and new messages arrive without a reload, like the app's 5-second poll. */
const REFRESH_MS = 10_000;

export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}

export function AddFriendForm() {
  const [state, action, busy] = useActionState(requestFriend, null);
  return (
    <form action={action} className="inline-form">
      <label htmlFor="friend-username" className="visually-hidden">Player account name</label>
      <input id="friend-username" name="username" className="line-input" placeholder="Friend’s account name" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]{3,32}" autoCapitalize="none" spellCheck={false} />
      <button className="pill" type="submit" disabled={busy}>Send</button>
      {state?.error && <p className="inline-error" role="alert">{state.error}</p>}
    </form>
  );
}

export function SendMessageForm({ peer }: { peer: string }) {
  const [state, action, busy] = useActionState(sendMessage, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (!busy && state === null) form.current?.reset(); }, [busy, state]);
  return (
    <form ref={form} action={action} className="compose">
      <input type="hidden" name="peer" value={peer} />
      <label htmlFor="message-text" className="visually-hidden">Message</label>
      <textarea id="message-text" name="text" className="line-input" rows={2} required maxLength={4000} placeholder="Write a message" />
      <button className="pill selected" type="submit" disabled={busy}>Send</button>
      {state?.error && <p className="inline-error" role="alert">{state.error}</p>}
    </form>
  );
}

/** Opening a conversation marks it read, as the app's Message Box does. */
export function MarkRead({ peer }: { peer: string }) {
  useEffect(() => {
    const form = new FormData();
    form.set('peer', peer);
    void markRead(form);
  }, [peer]);
  return null;
}
