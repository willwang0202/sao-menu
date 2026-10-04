// Local Postgres for development and end-to-end checks: PGlite over the wire protocol, migrated.
// Usage: node web/scripts/local-db.mjs [port]   then POSTGRES_URL=postgres://postgres@127.0.0.1:<port>/postgres
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const port = Number(process.argv[2] ?? 5433);
const MAX_CONNECTIONS = 16;
const migrations = path.join(import.meta.dirname, '../supabase/migrations');
const db = await PGlite.create();
for (const file of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(path.join(migrations, file), 'utf8'));
// Next.js route handlers and server actions each hold their own connection pool.
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: MAX_CONNECTIONS });
await server.start();
console.log(`Local account database ready on 127.0.0.1:${port}`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.stop(); await db.close(); process.exit(0); });
