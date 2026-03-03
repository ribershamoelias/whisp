-- F1 Day 1 storage hardening for refresh token persistence

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS family_id UUID,
  ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT;

ALTER TABLE refresh_tokens
  ALTER COLUMN family_id SET NOT NULL,
  ALTER COLUMN refresh_token_hash SET NOT NULL;

ALTER TABLE refresh_tokens
  DROP CONSTRAINT IF EXISTS refresh_tokens_refresh_token_hash_check;

ALTER TABLE refresh_tokens
  ADD CONSTRAINT refresh_tokens_refresh_token_hash_check
  CHECK (refresh_token_hash LIKE '$argon2id$%');

ALTER TABLE refresh_tokens
  DROP CONSTRAINT IF EXISTS refresh_tokens_parent_jti_fkey;

ALTER TABLE refresh_tokens
  ADD CONSTRAINT refresh_tokens_parent_jti_fkey
  FOREIGN KEY (parent_jti)
  REFERENCES refresh_tokens(jti)
  ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refresh_tokens_wid_device_family_id_jti_key'
  ) THEN
    ALTER TABLE refresh_tokens
      ADD CONSTRAINT refresh_tokens_wid_device_family_id_jti_key
      UNIQUE (wid, device_id, family_id, jti);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_refresh_active
  ON refresh_tokens (wid, device_id)
  WHERE revoked = false;
