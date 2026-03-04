# F3 Manual Adversarial Checklist

Phase: `F3`  
Date: `2026-03-04`  
Reviewer: `Security Lead`  
Status: `Signed`

## Session Bootstrap
- [x] Tampered signed prekey signature is rejected fail-closed.
- [x] Wrong identity key for known `(wid, device_id)` is rejected fail-closed.
- [x] Session-init replay with consumed prekey is rejected.

## Ratchet and Counters
- [x] Out-of-order message decrypt succeeds through skipped-key cache.
- [x] Duplicate counter replay is rejected as desync.
- [x] Rollbacked session state (older snapshot) is detected and rejected.

## Multi-Device
- [x] `(wid, device_id)` addressing is enforced for session state.
- [x] Message for `device_b1` cannot be decrypted on `device_b2`.
- [x] Compromised/invalid trust record blocks session continuation.

## Server Blindness
- [x] Relay has no decrypt path.
- [x] PreKey service stores only public material.
- [x] No server-side ratchet state.

## CI Evidence
- [x] `security` job green
- [x] `sast` job green
- [x] `api` + `mobile` jobs green
