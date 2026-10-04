import 'server-only';
import { cookies, headers } from 'next/headers';
import { accountService, clientAddress } from './service';

/** Web sessions reuse the desktop protocol's bearer token, kept in an HttpOnly cookie. */
const COOKIE = 'sao_session';
const SESSION_DAYS = 30;
const TOKEN = /^[a-zA-Z0-9_-]{43}$/;

export type AccountResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** Calls the account protocol in-process, with this visitor's IP for rate limiting. */
export async function callAccount<T>(route: string, body?: unknown, token?: string): Promise<AccountResult<T>> {
  const request = new Request(`https://sao.favioon.com/v1/${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await accountService().handle(request, clientAddress(await headers()));
  const data = await response.json() as T & { error?: string };
  return response.ok ? { ok: true, data } : { ok: false, status: response.status, error: data.error ?? 'The account service rejected this request.' };
}

export async function sessionToken(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  return value && TOKEN.test(value) ? value : null;
}

export async function startSession(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 24 * 60 * 60 });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
