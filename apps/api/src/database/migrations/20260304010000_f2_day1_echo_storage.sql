-- F2 Day 1 echo storage hardening

CREATE TABLE IF NOT EXISTS echo_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wid UUID NOT NULL REFERENCES users(wid) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  ciphertext_blob BYTEA NOT NULL CHECK (octet_length(ciphertext_blob) <= 65536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wid, device_id, message_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'echo_messages_wid_device_id_message_id_key'
  ) THEN
    ALTER TABLE echo_messages
      ADD CONSTRAINT echo_messages_wid_device_id_message_id_key
      UNIQUE (wid, device_id, message_id);
  END IF;
END $$;
