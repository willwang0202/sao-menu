-- Existing accounts deliberately start their day counter today; their original
-- signup dates were not stored. New registrations supply an exact timestamp.
ALTER TABLE sao.users ADD COLUMN IF NOT EXISTS created_at bigint NOT NULL
  DEFAULT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
