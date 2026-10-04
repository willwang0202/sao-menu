# sao-menu.favioon.com: website and hosted account service

Status as of October 3, 2026. The site, account API and desktop download are **live** at https://sao-menu.favioon.com. Download links target the cross-platform [v0.1.6 GitHub Release](https://github.com/willwang0202/sao-menu/releases/tag/v0.1.6).

## What it is

`web/` is a Next.js 16 app deployed on Vercel. It serves:

- **`/v1/*` and `/health`**: the account API the desktop app already speaks (register, login, state, friends, messages, logout). Requests go to the same protocol core the desktop app's local service uses, so the app needed no protocol changes.
- **`/`**: an SAO-styled landing page. Its hero plays the app's real-time Link Start tunnel, using the renderer in `src/ui/link-start`.
- **`/register` and `/login`**: sign-up and sign-in, drawn as the blue Link Start system card.
- **`/account`**: profile, friends with presence, incoming requests (YES/NO), and conversations with sending.

In version 0.1.6, the desktop app always connects to `https://sao-menu.favioon.com` (`DEFAULT_SERVICE_URL` in `src/shared/social.ts`), with no address control. Signup is available on the animated launch screen. Released 0.1.3 predates the default; its users enter the address once in **Account service** on the login card. The previous `sao.favioon.com` hostname remains attached to the same service so saved URLs and sessions keep working.

## Architecture

```
desktop app (SocialClient) ──HTTPS /v1──┐
browser ── pages / Server Actions ──────┤
                                        ▼
                 src/service/core.ts  (protocol, validation, scrypt, rate limits)
                        │ AccountStore interface (src/service/store.ts)
          ┌─────────────┴──────────────┐
  sqlite-store.ts                postgres-store.ts
  (local service, tests)         (Supabase via `postgres`, prepare:false)
```

- **Shared core.** `createAccountService(store)` holds every rule: username/password/display-name validation, scrypt hashing with a bounded number of concurrent hashes, 30-day sessions (newest 4 kept per user), friendships capped at 200, messages up to 4,000 characters, and generic error messages. `createSocialService(file)` is the SQLite wrapper. The SQLite schema is unchanged, so existing local data still opens.
- **Postgres store.** It uses the `sao` schema from the SQL files in `web/supabase/migrations/`. Statements are parameterized, and bigint columns are normalized to numbers. Rate limits use an atomic upsert in `sao.rate_limits`, so serverless instances share one counter.
- **Web sessions.** The browser keeps the same protocol token in an `HttpOnly; Secure; SameSite=Lax` cookie (`sao_session`, 30 days). Forms are Server Actions, which Next.js protects with an Origin check. `/session/end` clears an expired cookie, because pages can't change cookies while rendering.
- **Rate limiting.** Limits are keyed by the client IP from Vercel's `x-real-ip`/`x-forwarded-for`: 300 requests/min, 20 auth attempts/min, 30 friend requests/min, 60 messages/min.
- **Headers.** Every route sends HSTS (2 years), `X-Frame-Options: DENY`, `nosniff`, a strict Referrer-Policy and a Permissions-Policy. The API sends no CORS headers; the desktop client calls it from Node, not a browser page.

## Infrastructure

| Piece | Where | Identifier |
| --- | --- | --- |
| Vercel project | Team `willwang22-6748s-projects` (Pro) | `sao-menu` (`prj_DNCfmoJNbDPjAzCIP6LGLm67C1KM`); root directory `web`; Git-connected to `willwang0202/sao-menu`, so pushes to `main` deploy production |
| Database | Supabase, provisioned through the Vercel Marketplace | resource `sao-accounts`; env vars (`POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `SUPABASE_*`) injected into all environments |
| Domain | Vercel project domain | `sao-menu.favioon.com`, verified |
| DNS | Cloudflare zone `favioon.com` (Cloudflare nameservers) | `A sao-menu.favioon.com 76.76.21.21`, **DNS only (not proxied)**, so Vercel issues TLS and sees real client IPs |

`*.vercel.app` deployment URLs are behind Vercel Authentication; only the custom domain is public.

## Database security

Three independent layers keep the account tables away from Supabase's public APIs. Each was verified against the live database:

1. The tables are in schema `sao`, which PostgREST does not expose. A REST call with the anon key returns `PGRST106 Invalid schema: sao`.
2. Row level security is enabled on every table, with no policies.
3. `anon` and `authenticated` have no privileges on the schema, tables or sequences (`has_schema_privilege('anon','sao','USAGE') = false`).

Only the server-side `postgres` connection, which uses the project's database credentials, reads or writes these tables.

## Runbook

```sh
# Pull env vars (creates gitignored .env.local at the repo root)
vercel env pull .env.local

# Apply new migrations (idempotent; tracked in sao.schema_migrations)
node --env-file=.env.local web/scripts/migrate.mjs

# Local development against a migrated in-process Postgres (PGlite over the wire protocol)
node web/scripts/local-db.mjs 5433
cd web && POSTGRES_URL=postgres://postgres@127.0.0.1:5433/postgres npm run dev

# Browser end-to-end check; registers two throwaway players
node web/scripts/smoke-web.mjs http://localhost:3000
```

Deploy by pushing to `main`. Add schema changes as new files in `web/supabase/migrations/` and run the migrator before pushing code that depends on them.

After running `smoke-web.mjs` against production, delete its players. Cascades remove their sessions, friendships and messages:

```sql
DELETE FROM sao.users WHERE username ~ '^(kirito|asuna)_[a-z0-9]{6,10}$';
```

## Verification

- `npm test`: 98/98 pass. One protocol scenario runs against the SQLite store and against the Postgres store on PGlite with the production migration. Separate tests cover database-shared rate limiting across instances, the `sao` schema's privacy and RLS, and the default service URL.
- Root and `web/` TypeScript checks are clean, and `next build` succeeds.
- Locally, the full protocol scenario passed over HTTP through `next start`, the `postgres` driver and Postgres. The browser end-to-end test passed (landing, sign-up, account, YES on a request, a message round trip, phone width, log-out), and the screenshots were reviewed.
- Production:
  - The first Git deployment built in 20 s.
  - `https://sao-menu.favioon.com/health` returns `{"status":"ok","version":1}` over HTTP/2 with HSTS, and the landing page returns 200.
  - `smoke-web.mjs` passed against `https://sao-menu.favioon.com`.
  - Its two test players were then deleted, leaving 0 users, sessions, friendships and messages.
- Not yet verified: the packaged desktop app signing in to production. The app uses the same `/v1` HTTP calls that `smoke-web.mjs` exercised from Node, but no desktop run against the live service has been done.

## Open items

1. **Download (resolved).** The v0.1.6 release includes Mac Apple Silicon/Intel DMG and ZIP, Windows x64 installer and ZIP, and Linux x64 AppImage and DEB. Native CI packaged, verified and launched all four targets. The locally signed Apple Silicon installers replace the CI pair, with matching SHA-256 reports. The user chose public distribution, accepting that the build redistributes 1,108 assets imported from SAO Utils 2 on Steam and the anime's Link Start audio.
2. **Fixed service URL (resolved in 0.1.6).** New installations use sao-menu.favioon.com without configuration.
3. **No account deletion** in the protocol or on the site. It is needed before treating this as a public service; there is also no password reset.
4. **The build is not notarized.** Gatekeeper reports "Unnotarized Developer ID". Notarization needs the owner's Apple credentials.
5. **`sao.rate_limits` rows** are pruned only when a session is created (older than 24 h). That's fine at low volume; a scheduled cleanup would bound it under load.
6. **Agent-skill files** (`.agents/`, `.claude/`, `skills-lock.json`) are local integration tooling and ignored by Git.

## Parties and battery HP in 0.1.6

Parties, memberships and invitations persist in the private `sao` schema. Invitations require an accepted friendship, only the recipient can accept, and a player can belong to one party of at most six players. Transactions serialize capacity checks. Leaving transfers leadership or removes an empty party. Authenticated native clients report only battery percentage every 30 seconds, defaulting to 100% without battery telemetry; battery values are returned only in the current party snapshot. Account display names drive both the menu and HP labels.
