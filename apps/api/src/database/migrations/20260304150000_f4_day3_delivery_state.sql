-- F4 Day 3: Device-scoped delivery and read state

DROP INDEX IF EXISTS idx_messages_conversation_seq;
DROP INDEX IF EXISTS idx_messages_sender_device_client_id;

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS uq_messages_conversation_seq,
  DROP CONSTRAINT IF EXISTS uq_messages_sender_device_client_id;

ALTER TABLE messages
  ADD CONSTRAINT uq_messages_conversation_seq UNIQUE (conversation_id, seq),
  ADD CONSTRAINT uq_messages_sender_device_client_id UNIQUE (sender_device_id, client_message_id);

CREATE TABLE IF NOT EXISTS delivery_state (
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

CREATE INDEX IF NOT EXISTS idx_delivery_state_target_device_delivered
  ON delivery_state(target_wid, target_device_id, delivered_at);

CREATE INDEX IF NOT EXISTS idx_delivery_state_target_device_read
  ON delivery_state(target_wid, target_device_id, read_at);
