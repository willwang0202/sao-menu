-- Battery presence is visible only through an authenticated party snapshot.
ALTER TABLE sao.users ADD COLUMN battery_percent integer NOT NULL DEFAULT 100 CHECK (battery_percent BETWEEN 0 AND 100);
CREATE TABLE sao.parties (
  id text PRIMARY KEY,
  leader_id text NOT NULL REFERENCES sao.users(id) ON DELETE CASCADE,
  created_at bigint NOT NULL
);
CREATE TABLE sao.party_members (
  user_id text PRIMARY KEY REFERENCES sao.users(id) ON DELETE CASCADE,
  party_id text NOT NULL REFERENCES sao.parties(id) ON DELETE CASCADE,
  joined_at bigint NOT NULL
);
CREATE INDEX party_member_party ON sao.party_members(party_id);
CREATE TABLE sao.party_invites (
  id text PRIMARY KEY,
  party_id text NOT NULL REFERENCES sao.parties(id) ON DELETE CASCADE,
  from_id text NOT NULL REFERENCES sao.users(id) ON DELETE CASCADE,
  to_id text NOT NULL REFERENCES sao.users(id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  UNIQUE (party_id,to_id)
);
CREATE INDEX party_invite_recipient ON sao.party_invites(to_id);
CREATE INDEX party_invite_sender ON sao.party_invites(from_id);
ALTER TABLE sao.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE sao.party_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sao.party_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sao.parties,sao.party_members,sao.party_invites FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON sao.parties,sao.party_members,sao.party_invites FROM anon,authenticated;
  END IF;
END $$;
