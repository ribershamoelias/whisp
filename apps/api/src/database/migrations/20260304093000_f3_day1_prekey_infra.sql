-- F3 Day 1 prekey infrastructure

CREATE TABLE IF NOT EXISTS identity_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  identity_public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wid, device_id)
);

CREATE TABLE IF NOT EXISTS signed_prekeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  signed_prekey_id BIGINT NOT NULL,
  signed_prekey_public TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wid, device_id, signed_prekey_id)
);

CREATE TABLE IF NOT EXISTS one_time_prekeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  prekey_id BIGINT NOT NULL,
  public_key TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wid, device_id, prekey_id)
);

CREATE INDEX IF NOT EXISTS idx_one_time_prekeys_wid_device_used
  ON one_time_prekeys(wid, device_id, used);
