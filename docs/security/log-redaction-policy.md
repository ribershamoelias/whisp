# Log Redaction Policy (Phase 1)

## Scope
Applies to API logs, tracing events, error payloads, queue logs, and CI test logs.

## Redaction Rules
1. Never log message plaintext.
2. Never log full `ciphertext_blob`.
3. Never log private keys, prekeys, or session secrets.
4. Never log full access/refresh tokens.
5. Never log authorization headers.
6. Never log full device key material.

## Allowed Logging
1. `wid` (pseudonymous identifier).
2. `space_id`, `message_id`, `request_id`.
3. permission `deny_reason`.
4. status codes, latency, retry counters.

## Mandatory Redaction Patterns
- `Authorization: Bearer <token>` -> `Authorization: Bearer [REDACTED]`
- `refresh_token_value` -> `[REDACTED]`
- `access_token` -> `[REDACTED]`
- `ciphertext_blob` -> `[REDACTED_CIPHERTEXT]`
- `private_key`, `identity_key`, `prekey` -> `[REDACTED_KEY_MATERIAL]`

## Implementation Controls
1. Structured logger denylist for sensitive fields.
2. HTTP logging middleware strips auth headers and token fields.
3. Relay module logs only payload size + message_id, never blob content.
4. OpenTelemetry attribute filter denies token/key/message fields.
5. CI includes forbidden-pattern scan (build fails on violation).

## Verification
1. Unit tests for logger sanitizer.
2. Integration test verifies redacted auth and relay logs.
3. Nightly security regression scans runtime logs for forbidden patterns.
