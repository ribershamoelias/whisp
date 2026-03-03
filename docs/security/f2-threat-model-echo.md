# Threat Model v2 (F2 Encrypted Echo Path)

Version: `v2-f2-echo`  
Phase: `F2`  
Scope: Relay Echo ciphertext transport (`/relay/echo` only)

## Security Boundary
- Client performs encryption and decryption.
- Relay stores and returns ciphertext envelope.
- Server must not derive plaintext, keys, or session state.

## Assets
- Plaintext message payload (client-only).
- Ciphertext envelope (`ciphertext`, `nonce`, `aad`, `key_ref`, `message_id`).
- Minimal metadata (`wid`, timestamps, transport status).
- Log streams and traces.

## Trust Assumptions
- TLS between client and API gateway is valid.
- Server runtime is untrusted for plaintext confidentiality.
- Client key storage remains local and protected by platform secure storage.

## Threats and Mitigations

### T1: Ciphertext Manipulation Attack
Attack:
- Adversary alters ciphertext, nonce, aad, or key_ref in transit/storage.

Impact:
- Corrupted payload accepted as valid, undefined decrypt behavior.

Mitigations:
- Client decryption must be authenticated and fail-closed on any mismatch.
- Relay returns exact stored bytes without transformation.
- Integration test with tampered envelope must fail decryption deterministically.

Evidence Required:
- `echo_tamper_detection_test` report.
- Roundtrip byte-equality assertion in API integration tests.

### T2: Replay Attack on Relay
Attack:
- Adversary replays the same `message_id` or ciphertext envelope to create duplicates/state confusion.

Impact:
- Duplicate entries, potential app-level confusion, abuse amplification.

Mitigations:
- Idempotency/replay rule for echo submit (`message_id` uniqueness per `wid`).
- Deterministic duplicate response (`409` or explicit idempotent response contract).
- Replay regression tests in CI.

Evidence Required:
- DB unique constraint proof.
- `echo_replay_rejected_test` CI artifact.

### T3: Metadata Leakage
Attack:
- Relay/API returns or stores excessive metadata that reveals communication semantics.

Impact:
- Behavioral/privacy leakage despite ciphertext confidentiality.

Mitigations:
- Persist only required fields for echo transport.
- No plaintext-derived indexes, no semantic tags.
- API response schema minimized and reviewed.

Evidence Required:
- Schema diff showing minimal columns.
- Contract test proving response excludes plaintext/sensitive fields.

### T4: Log Exfiltration Scenario
Attack:
- Ciphertext blobs, auth headers, or key references appear in logs and observability sinks.

Impact:
- Data exfiltration through logging pipeline.

Mitigations:
- SafeLogger redaction for auth headers, token-like fields, key material, ciphertext payload fields.
- CI checks for forbidden logging patterns.
- E2E log-redaction test on echo endpoints.

Evidence Required:
- `check_no_console` and logging policy CI pass.
- `echo_log_redaction_test` pass with substring assertions.

### T5: Malformed Ciphertext Handling
Attack:
- Attacker submits malformed base64/invalid envelope structures to trigger parser edge cases.

Impact:
- Server exceptions (`500`), denial-of-service amplification, undefined behavior.

Mitigations:
- Strict DTO validation and schema checks.
- Fail-closed rejection with deterministic `400`.
- No stack traces or parser internals in error body.

Evidence Required:
- Integration tests for malformed envelope classes.
- Error contract verification.

### T6: Large Payload DoS
Attack:
- Oversized ciphertext payload floods memory/DB/logging path.

Impact:
- Resource exhaustion, degraded API availability.

Mitigations:
- Hard maximum payload size in gateway/controller validation.
- Request body limit and early rejection.
- Rate limiting remains active from F0 baseline.

Evidence Required:
- Large payload rejection integration test.
- CI load-sanity check result for boundary payload sizes.

## Non-Goals in F2 Threat Scope
- Multi-user session confidentiality guarantees.
- Forward secrecy and ratchet compromise analysis.
- Group membership/role abuse analysis.

## Residual Risks (Accepted for F2)
- Metadata still includes minimal transport timing and sender identity.
- No anti-traffic-analysis guarantees in F2.
- Echo flow cannot prove multi-device key-consistency yet.

## F2 Security Gate Mapping
- `ciphertext_never_logged` -> T4 mitigations + CI redaction tests.
- `plaintext_never_persisted` -> T3 schema constraints + negative DB assertions.
- `tamper_detected_client_side` -> T1 decryption-failure tests.
- `replay_control_active` -> T2 idempotency + duplicate handling tests.
- `dos_limit_enforced` -> T6 payload-limit tests.
