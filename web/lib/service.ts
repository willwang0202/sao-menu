import 'server-only';
import postgres from 'postgres';
import { createAccountService, type AccountService } from '../../src/service/core';
import { createPostgresStore } from '../../src/service/postgres-store';
import type { QueryClient } from '../../src/service/party-store';

/** Connections per serverless instance; Supabase's pooler multiplexes them. */
const MAX_CONNECTIONS = 3;
const IDLE_TIMEOUT_SECONDS = 20;
const CONNECT_TIMEOUT_SECONDS = 10;

let service: AccountService | null = null;

/** The hosted account service over Supabase Postgres, created on first use. */
export function accountService(): AccountService {
  if (service) return service;
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error('POSTGRES_URL is not set. Connect the Supabase integration to this Vercel project.');
  // Supabase's transaction pooler does not support prepared statements.
  const sql = postgres(url, { prepare: false, max: MAX_CONNECTIONS, idle_timeout: IDLE_TIMEOUT_SECONDS, connect_timeout: CONNECT_TIMEOUT_SECONDS });
  service = createAccountService(createPostgresStore({
    query: (text, params = []) => sql.unsafe(text, params as postgres.ParameterOrJSON<never>[]),
    transaction: async <T>(work: (client: QueryClient) => Promise<T>): Promise<T> => {
      let value!: T;
      await sql.begin(async tx => { value = await work({ query: (text, params = []) => tx.unsafe(text, params as postgres.ParameterOrJSON<never>[]) }); });
      return value;
    },
  }));
  return service;
}

/** Client IP for rate limiting. Vercel's edge sets these headers and overwrites client-supplied values. */
export function clientAddress(headers: Headers): string {
  return headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
