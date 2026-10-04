'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { callAccount, endSession, sessionToken, startSession } from '@/lib/session';

/** Form actions for the web account pages. Validation happens once, in the shared protocol core. */
export type FormState = { error: string } | null;

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};

export async function register(_state: FormState, form: FormData): Promise<FormState> {
  const result = await callAccount<{ token: string }>('register', { username: field(form, 'username'), displayName: field(form, 'displayName'), password: field(form, 'password') });
  if (!result.ok) return { error: result.error };
  await startSession(result.data.token);
  redirect('/account');
}

export async function login(_state: FormState, form: FormData): Promise<FormState> {
  const result = await callAccount<{ token: string }>('login', { username: field(form, 'username'), password: field(form, 'password') });
  if (!result.ok) return { error: result.error };
  await startSession(result.data.token);
  redirect('/account');
}

export async function logout(): Promise<void> {
  const token = await sessionToken();
  if (token) await callAccount('logout', {}, token);
  await endSession();
  redirect('/');
}

/** Runs a signed-in operation; an expired session sends the visitor back to sign in. */
async function signedIn(route: string, body: Record<string, string>): Promise<FormState> {
  const token = await sessionToken();
  if (!token) redirect('/login');
  const result = await callAccount(route, body, token);
  if (!result.ok && result.status === 401) { await endSession(); redirect('/login'); }
  revalidatePath('/account');
  return result.ok ? null : { error: result.error };
}

export async function requestFriend(_state: FormState, form: FormData): Promise<FormState> {
  return signedIn('friends/request', { username: field(form, 'username') });
}

export async function resolveRequest(form: FormData): Promise<void> {
  await signedIn('friends/resolve', { id: field(form, 'id'), action: field(form, 'action') });
}

export async function sendMessage(_state: FormState, form: FormData): Promise<FormState> {
  return signedIn('messages/send', { peer: field(form, 'peer'), text: field(form, 'text') });
}

export async function markRead(form: FormData): Promise<void> {
  await signedIn('messages/read', { peer: field(form, 'peer') });
}
