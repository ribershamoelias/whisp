-- F4 Day 1: Conversation model and monotonic sequence metadata core

CREATE TABLE IF NOT EXISTS conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type = '1to1'),
  participant_a_wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  participant_b_wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (participant_a_wid <> participant_b_wid),
  UNIQUE (type, participant_a_wid, participant_b_wid)
);

CREATE TABLE IF NOT EXISTS conversation_seq (
  conversation_id UUID PRIMARY KEY REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  next_seq BIGINT NOT NULL DEFAULT 1 CHECK (next_seq >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sender_device_id TEXT,
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS seq BIGINT CHECK (seq >= 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conversation_seq
  ON messages(conversation_id, seq)
  WHERE conversation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_sender_device_client_id
  ON messages(sender_device_id, client_message_id)
  WHERE sender_device_id IS NOT NULL AND client_message_id IS NOT NULL;
