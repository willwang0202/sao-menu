import { NextResponse } from 'next/server';
import { endSession } from '@/lib/session';

/** Clears an expired session cookie, then returns to sign-in (pages cannot change cookies while rendering). */
export async function GET(request: Request) {
  await endSession();
  return NextResponse.redirect(new URL('/login', request.url));
}
