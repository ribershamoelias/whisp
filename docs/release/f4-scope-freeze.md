# F4 Scope Freeze

Phase: `F4`  
Focus: `Multi-Device Messaging Orchestration over F3 Signal Core`  
Date: `2026-03-04`

## In Scope
- Server-side multi-device fan-out orchestration.
- Deterministic per-conversation ordering (`conversation_seq`).
- Idempotent message send (`client_message_id` with unique constraint).
- Offline delivery queue per target device.
- Device-scoped delivery/read state tracking.
- Deterministic resync API (`from_seq -> latest`).
- API and DB contracts for conversation/message/envelope/delivery entities.

## Out of Scope
- New cryptographic primitives.
- Changes to X3DH / Double Ratchet internals.
- Group messaging, sender keys, MLS.
- Attachments/media pipeline.
- Presence/typing indicators.
- UX polish and UI redesign.
- Permission engine refactors outside required endpoint wiring.

## Non-Negotiables
- Server never sees plaintext.
- Server never sees session keys.
- Server never stores ratchet state.
- Fan-out uses ciphertext envelopes only.
- Message ordering is server-authoritative and monotonic per conversation.
- Retries are idempotent and cannot create duplicates.
- Delivery state is device-scoped, not wid-scoped.
- Resync is deterministic (no heuristic merge/reorder).

## Explicit No-Group Guarantee
F4 must not introduce group conversation types, sender-key distribution, MLS endpoints, or any schema/API primitive that implies group membership semantics.

## CI Scope-Drift Blockers
- Fail CI if new group/MLS/sender-key/media endpoints are added.
- Fail CI if any server module imports or references signal session state handling.
- Fail CI if any server payload schema introduces plaintext message fields.
