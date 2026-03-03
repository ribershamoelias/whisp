-- WHISP Phase 1 schema (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  wid UUID PRIMARY KEY,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wid, device_id)
);

CREATE TABLE spaces (
  space_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('private', 'school', 'public')),
  public_flag BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users(wid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES spaces(space_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('member', 'moderator', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wid, space_id)
);

CREATE TABLE messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(space_id) ON DELETE CASCADE,
  sender_wid UUID NOT NULL REFERENCES users(wid),
  ciphertext_blob TEXT NOT NULL,
  client_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_space_created_at ON messages(space_id, created_at DESC);

CREATE TABLE echo_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  ciphertext_blob BYTEA NOT NULL CHECK (octet_length(ciphertext_blob) <= 65536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wid, device_id, message_id)
);

CREATE TABLE requests (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  to_wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_wid, to_wid, status)
);

CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  blocked_wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (blocker_wid <> blocked_wid),
  UNIQUE (blocker_wid, blocked_wid)
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  family_id UUID NOT NULL,
  jti UUID NOT NULL,
  parent_jti UUID REFERENCES refresh_tokens(jti) ON DELETE SET NULL,
  refresh_token_hash TEXT NOT NULL CHECK (refresh_token_hash LIKE '$argon2id$%'),
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (jti),
  UNIQUE (wid, device_id, family_id, jti)
);

CREATE INDEX idx_refresh_tokens_wid_device ON refresh_tokens(wid, device_id);
CREATE INDEX idx_refresh_active ON refresh_tokens(wid, device_id) WHERE revoked = false;
