import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createAccountService } from '../src/service/core';
import { createPostgresStore, type SqlClient } from '../src/service/postgres-store';
import { runAccountScenario } from './fixtures/account-scenario';

const MIGRATION = 'web/supabase/migrations/20261003000000_accounts.sql';

async function database() {
  const db = new PGlite();
  await db.exec(await readFile(MIGRATION, 'utf8'));
  const client: SqlClient = { query: async (text, params = []) => (await db.query(text, params as unknown[])).rows as Record<string, unknown>[] };
  return { db, client };
}

test('the Postgres store satisfies the desktop account protocol', async () => {
  const { db, client } = await database();
  try {
    await runAccountScenario(
      request => createAccountService(createPostgresStore(client)).handle(request),
      async () => request => createAccountService(createPostgresStore(client)).handle(request),
    );
  } finally { await db.close(); }
});

test('rate limits are shared through the database across service instances', async () => {
  const { db, client } = await database();
  try {
    const store = createPostgresStore(client);
    const now = Date.now();
    for (let i = 0; i < 3; i++) assert.equal(await store.hit('auth:1.2.3.4', 3, 60_000, now), true);
    assert.equal(await createPostgresStore(client).hit('auth:1.2.3.4', 3, 60_000, now), false, 'a second instance sees the same counter');
    assert.equal(await store.hit('auth:1.2.3.4', 3, 60_000, now + 60_000), true, 'the window resets');
  } finally { await db.close(); }
});

test('account tables are private: own schema, row level security on, no API role grants', async () => {
  const { db } = await database();
  try {
    const tables = (await db.query<{ tablename: string; rowsecurity: boolean }>("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='sao'")).rows;
    assert.deepEqual(tables.map(table => table.tablename).sort(), ['friendships', 'messages', 'rate_limits', 'sessions', 'users']);
    assert.ok(tables.every(table => table.rowsecurity), 'RLS denies PostgREST access even if the schema is exposed later');
    const publicTables = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'")).rows[0].n;
    assert.equal(publicTables, 0, 'nothing lands in the PostgREST-exposed public schema');
  } finally { await db.close(); }
});
