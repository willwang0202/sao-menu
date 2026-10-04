-- SAO Utils account service. Only the server (direct Postgres connection) reads these tables.
-- They live in their own schema, outside Supabase's PostgREST-exposed `public`, with row level
-- security enabled and no policies, so the anon/authenticated API roles can never reach them.
CREATE SCHEMA IF NOT EXISTS sao;

CREATE TABLE IF NOT EXISTS sao.users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (username = lower(username)),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  password text NOT NULL,
  salt text NOT NULL,
  last_seen bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS sao.sessions (
  hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES sao.users(id) ON DELETE CASCADE,
  expires bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sao.sessions(user_id);

CREATE TABLE IF NOT EXISTS sao.friendships (
  id text PRIMARY KEY,
  from_id text NOT NULL REFERENCES sao.users(id) ON DELETE CASCADE,
  to_id text NOT NULL REFERENCES sao.users(id) ON DELETE CASCADE,
  pair_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS friendships_from ON sao.friendships(from_id);
CREATE INDEX IF NOT EXISTS friendships_to ON sao.friendships(to_id);

CREATE TABLE IF NOT EXISTS sao.messages (
  seq bigserial UNIQUE,
  id text PRIMARY KEY,
  from_id text NOT NULL REFERENCES sao.users(id) ON DELETE CASCADE,
  to_id text NOT NULL REFERENCES sao.users(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 4000),
  created_at bigint NOT NULL,
  read_at bigint
);
CREATE INDEX IF NOT EXISTS messages_pair ON sao.messages(from_id, to_id, created_at);

CREATE TABLE IF NOT EXISTS sao.rate_limits (
  key text PRIMARY KEY,
  window_start bigint NOT NULL,
  count integer NOT NULL
);

ALTER TABLE sao.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sao.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sao.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE sao.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sao.rate_limits ENABLE ROW LEVEL SECURITY;

-- Supabase's API roles exist only on Supabase; skip quietly elsewhere (local tests).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA sao FROM anon, authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA sao FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA sao FROM anon, authenticated;
  END IF;
END $$;
