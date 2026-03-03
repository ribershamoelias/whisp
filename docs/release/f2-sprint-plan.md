# F2 Sprint Plan (Encrypted Echo Path)

Scope lock: **Encrypted Echo only**. No multi-user messaging, no session setup/rotation, no pre-key bundle flow, no groups, no identity expansion, no permission-engine refactor, no UX polish.

## Scope
### In Scope
- Client-side payload encryption for self-echo test flow.
- Relay transport of ciphertext-only payloads.
- Ciphertext persistence with minimal metadata.
- Client-side local decryption of echoed payloads.
- Evidence-driven security validation for ciphertext-only server behavior.

### Out of Scope
- Multi-user routing and recipient fanout.
- Signal session establishment and double-ratchet state transitions.
- PreKey bundle exchange and server key-distribution semantics.
- Space/group message flows.
- Retry-optimization refactors or queue redesign.

## F2 Deliverables
- Echo endpoint in relay module (`POST /relay/echo`, `GET /relay/echo/{message_id}`).
- Ciphertext-focused DB persistence path and migration.
- Client crypto adapter boundary (`encryptForEcho`, `decryptFromEcho`) with no server crypto.
- Integration tests for ciphertext roundtrip (API + mobile adapter).
- Security proof tests that server cannot reconstruct plaintext.

## Architecture Flow (Echo)
1. Mobile client builds plaintext test payload locally.
2. Mobile crypto adapter encrypts payload and returns `{ciphertext, nonce, aad, key_ref}`.
3. Client sends ciphertext envelope to relay echo endpoint.
4. Relay validates schema/size, stores only envelope metadata + ciphertext blob.
5. Relay returns stored envelope unchanged.
6. Client fetches echo result and decrypts locally.
7. Client asserts decrypted payload equals original plaintext.

## Day 1
### Ziele
- Echo persistence model und transport contract festziehen.

### Konkrete Tasks
- Define OpenAPI for `/relay/echo` submit/read contracts.
- Add DB migration for `echo_messages` with metadata minimization.
- Add schema constraint notes in `schema.sql` (ciphertext required, plaintext columns forbidden).
- Add CI assertion to fail on plaintext echo columns/fields.

### Deliverables
- OpenAPI update for echo endpoints.
- Versioned migration + schema update.
- CI schema guard script for plaintext field ban.

### Tests (müssen grün sein)
- OpenAPI validation (errors=0).
- Migration reproducibility.
- Negative schema test: plaintext echo column insertion attempt fails.

### Gate am Tagesende
- Echo storage path exists and structurally enforces ciphertext-only model.

## Day 2
### Ziele
- Relay Echo endpoint implementieren ohne crypto logic.

### Konkrete Tasks
- Implement `RelayEchoController` and service methods for submit/read.
- Enforce max payload size and strict envelope validation.
- Enforce no transform pass-through semantics for ciphertext fields.
- Wire policy guard annotation for mutating echo submit endpoint.

### Deliverables
- Echo endpoint code and tests.
- Relay validation rules and error mapping.

### Tests (müssen grün sein)
- Unit tests for envelope validation and fail-closed behavior.
- Integration test: submit -> fetch returns exact ciphertext envelope.
- Integration test: malformed ciphertext payload rejected.

### Gate am Tagesende
- Relay acts as transparent ciphertext transport, not a crypto participant.

## Day 3
### Ziele
- Mobile crypto adapter boundary und echo roundtrip stabilisieren.

### Konkrete Tasks
- Implement client adapter interface for local echo encryption/decryption.
- Integrate adapter into messaging data source echo path.
- Persist local echo test records as ciphertext-only.
- Add adapter negative tests (tampered ciphertext, bad nonce, wrong key_ref).

### Deliverables
- `signal_client.dart` adapter methods for echo boundary.
- Messaging remote/local data source echo hooks.
- Adapter unit tests.

### Tests (müssen grün sein)
- Mobile unit tests: encrypt/decrypt success path.
- Mobile unit tests: tampering detected and decryption fails closed.
- Contract test: server response decryptable only client-side.

### Gate am Tagesende
- End-to-end echo works with client-only decryption and tamper detection.

## Day 4
### Ziele
- Security hardening for relay abuse and leakage.

### Konkrete Tasks
- Add replay-detection strategy for echo message IDs (idempotency control).
- Add log-redaction assertions for relay echo payload/body.
- Add metadata minimization checks in API responses.
- Add large-payload DoS handling tests and limits.

### Deliverables
- Replay controls for echo endpoints.
- Log redaction tests for relay echo.
- Payload limit enforcement tests.

### Tests (müssen grün sein)
- Replay attempt test (`message_id` reuse handling deterministic).
- Log exfiltration regression test (ciphertext/tokens not logged).
- Large payload rejected deterministically.

### Gate am Tagesende
- Echo path resilient against replay/leakage/oversize abuse.

## Day 5
### Ziele
- F2 Gate readiness dokumentieren und verifizieren.

### Konkrete Tasks
- Consolidate all relay echo integration/security tests.
- Meet relay module coverage target.
- Finalize threat-model mapping and manual checklist.
- Confirm no F3 scope overlap in changed files.

### Deliverables
- F2 test report bundle.
- F2 manual attack checklist and gate evidence links.
- Final sprint sign-off entry.

### Tests (müssen grün sein)
- Full CI green.
- Relay coverage target met: >=90% lines and >=90% branches for relay module.
- Security regression suite green.

### Gate am Tagesende
- F2 echo pipeline formally gate-ready.

## F2 Gate Criteria
- Ciphertext never logged.
- No plaintext in DB (assertion test required).
- Decryption strictly client-side.
- CI fully green.
- Relay module coverage threshold met.
- Manipulation detection proven (tampered ciphertext fails).

## Stop Conditions
- Any plaintext field appears in relay persistence path.
- Any server-side crypto operation is added to echo flow.
- Echo endpoint accepts malformed envelope without deterministic rejection.
- Security regression test for logging/replay/tamper fails.
