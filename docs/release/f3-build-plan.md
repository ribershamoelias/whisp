# F3 Build Plan (Day 1-5)

Scope lock: **Signal 1:1 PreKey only**. No groups, no MLS, no media, no UX expansion.

## Day 1 - PreKey Storage + API
### Ziele
- Per-device prekey persistence and retrieval contracts.

### Tasks
- Add DB tables for device identity key, signed prekey, one-time prekeys.
- Implement prekey upload endpoint with strict schema validation.
- Implement prekey bundle fetch endpoint by `(wid, device_id)`.
- Add atomic one-time prekey consume path.

### Gate
- Duplicate/invalid prekeys rejected deterministically.
- One-time prekey cannot be consumed twice.

## Day 2 - Client Key Generation + Bundle Verification
### Ziele
- Device-side key lifecycle and bundle authenticity verification.

### Tasks
- Integrate native libsignal wrapper boundary (FFI adapter interface).
- Generate/store device identity key + signed prekey + OPK batch locally.
- Upload bundle to backend.
- Verify signed prekey signature when fetching peer bundle.

### Gate
- Invalid signed prekey signature fails closed.
- Identity key mismatch detected before session init.

## Day 3 - Session Establishment + First Message
### Ziele
- X3DH session bootstrap and first decryptable message.

### Tasks
- Implement X3DH init for sender using fetched bundle.
- Implement receiver prekey message processing.
- Send first 1:1 ciphertext via relay.
- Store ratchet state per `(peer_wid, peer_device_id)`.

### Gate
- First message decrypt succeeds only on correct recipient device.
- Replay of session-init artifact rejected.

## Day 4 - Double Ratchet State + Multi-Device Isolation
### Ziele
- Ratchet advancement and device-level session isolation.

### Tasks
- Advance ratchet state for consecutive messages.
- Add session desync handling paths and deterministic errors.
- Add cross-device isolation tests (A1->B1 does not decrypt on B2).
- Add identity-key-change fail-closed handling.

### Gate
- Cross-device confusion tests pass.
- Identity key change requires explicit trust reset (no silent continue).

## Day 5 - Hardening + Formal Gate
### Ziele
- Final security regressions, coverage, and formal go/no-go.

### Tasks
- Consolidate F3 security regression suite.
- Enforce coverage threshold for session/prekey modules.
- Add CI scope-drift guard (no group/MLS/media changes).
- Finalize threat model and manual adversarial checklist.
- Produce formal `f3-gate-check.md`.

### Gate
- CI fully green with required checks.
- All critical security regressions green.
- F3 gate decision recorded as GO/NO-GO.

## Daily Required Evidence
- Commit hash.
- CI run link.
- Day sign-off PASS/FAIL.
