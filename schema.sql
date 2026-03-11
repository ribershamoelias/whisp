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

CREATE TABLE conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type = '1to1'),
  participant_a_wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  participant_b_wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (participant_a_wid <> participant_b_wid),
  UNIQUE (type, participant_a_wid, participant_b_wid)
);

CREATE TABLE conversation_seq (
  conversation_id UUID PRIMARY KEY REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  next_seq BIGINT NOT NULL DEFAULT 1 CHECK (next_seq >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  sender_device_id TEXT,
  conversation_id UUID REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  seq BIGINT CHECK (seq >= 1),
  ciphertext_blob TEXT NOT NULL,
  client_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, seq),
  UNIQUE (sender_device_id, client_message_id)
);

CREATE INDEX idx_messages_space_created_at ON messages(space_id, created_at DESC);

CREATE TABLE delivery_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  seq BIGINT NOT NULL CHECK (seq >= 1),
  target_wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  target_device_id TEXT NOT NULL,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (read_at IS NULL OR delivered_at IS NOT NULL),
  UNIQUE (conversation_id, seq, target_device_id),
  FOREIGN KEY (conversation_id, seq)
    REFERENCES messages(conversation_id, seq)
    ON DELETE CASCADE
);

CREATE INDEX idx_delivery_state_target_device_delivered
  ON delivery_state(target_wid, target_device_id, delivered_at);
CREATE INDEX idx_delivery_state_target_device_read
  ON delivery_state(target_wid, target_device_id, read_at);

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

CREATE TABLE identity_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  identity_public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wid, device_id)
);

CREATE TABLE signed_prekeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  signed_prekey_id BIGINT NOT NULL,
  signed_prekey_public TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wid, device_id, signed_prekey_id)
);

CREATE TABLE one_time_prekeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  prekey_id BIGINT NOT NULL,
  public_key TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wid, device_id, prekey_id)
);

CREATE INDEX idx_one_time_prekeys_wid_device_used
  ON one_time_prekeys(wid, device_id, used);
