// Read-only verification of the deployed private account schema; never reads account rows.
// node --env-file=.env.local web/scripts/verify-schema.mjs
import assert from 'node:assert/strict';
import postgres from 'postgres';
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { max: 1, onnotice: () => {} });
try {
  const tables = await sql`SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='sao'`;
  for (const name of ['users', 'parties', 'party_members', 'party_invites']) assert.ok(tables.some(table => table.tablename === name && table.rowsecurity), `${name} must exist with RLS`);
  const column = await sql`SELECT column_default,is_nullable FROM information_schema.columns WHERE table_schema='sao' AND table_name='users' AND column_name='battery_percent'`;
  assert.equal(column[0]?.column_default, '100'); assert.equal(column[0]?.is_nullable, 'NO');
  const grants = await sql`SELECT count(*)::int AS n FROM information_schema.role_table_grants WHERE table_schema='sao' AND grantee IN ('anon','authenticated','PUBLIC')`;
  assert.equal(grants[0].n, 0);
  const schemaAccess = await sql`SELECT has_schema_privilege('anon','sao','USAGE') AS anon,has_schema_privilege('authenticated','sao','USAGE') AS authenticated`;
  assert.equal(schemaAccess[0].anon, false); assert.equal(schemaAccess[0].authenticated, false);
  console.log(`PASS: ${tables.length} private account tables have RLS; battery defaults to 100; no public API role has table grants or schema access.`);
} finally { await sql.end(); }
