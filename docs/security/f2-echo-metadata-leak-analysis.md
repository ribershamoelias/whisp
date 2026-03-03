# F2 Day 3 Metadata Leak Analysis (Echo Path)

Scope: `/relay/echo` submit/fetch responses and `echo_messages` persistence shape.

## Persisted Fields (Allowed)
- `wid`
- `device_id`
- `message_id`
- `ciphertext_blob`
- `created_at`

## Prohibited Fields
- Any plaintext or decrypted payload field.
- Message semantic labels (`type`, `topic`, `preview`, `content`).
- Header/body debug mirrors.
- Arbitrary metadata blobs (`metadata_json`, `debug_payload`).

## API Response Contract
Echo responses are constrained to:
- `wid`
- `device_id`
- `message_id`
- `ciphertext`
- `created_at`

No token material, no auth context, no transport headers, no plaintext-derived values.

## Logging Surface
- Request interceptor logs request body.
- `SafeLogger` redacts `ciphertext` and `ciphertext_blob` fields before sink write.
- Binary/base64 payload values are asserted absent in e2e regression.

## Residual Metadata Exposure (Accepted in F2)
- Sender identity (`wid`), device identifier (`device_id`), and timestamp (`created_at`).
- Message uniqueness handle (`message_id`) for replay control.

These are required for transport determinism and replay blocking in Echo scope.
