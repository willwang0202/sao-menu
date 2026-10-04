// Applies web/supabase/migrations/*.sql in order, once each, over the direct (non-pooled) connection.
// Usage: node --env-file=.env.local web/scripts/migrate.mjs
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const url = process.env.POSTGRES_URL_NON_POOLING;
if (!url) throw new Error('Set POSTGRES_URL_NON_POOLING (vercel env pull .env.local).');
const folder = path.join(import.meta.dirname, '../supabase/migrations');
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql`CREATE SCHEMA IF NOT EXISTS sao`;
  await sql`CREATE TABLE IF NOT EXISTS sao.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE sao.schema_migrations ENABLE ROW LEVEL SECURITY`;
  const applied = new Set((await sql`SELECT name FROM sao.schema_migrations`).map(row => row.name));
  for (const name of (await readdir(folder)).filter(file => file.endsWith('.sql')).sort()) {
    if (applied.has(name)) { console.log(`skip    ${name}`); continue; }
    const text = await readFile(path.join(folder, name), 'utf8');
    await sql.begin(async transaction => {
      await transaction.unsafe(text);
      await transaction`INSERT INTO sao.schema_migrations (name) VALUES (${name})`;
    });
    console.log(`applied ${name}`);
  }
} finally { await sql.end(); }
