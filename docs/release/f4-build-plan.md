# F4 Build Plan (Current Baseline)

Scope lock: **multi-device messaging orchestration only**.  
No new crypto. No groups. No media. No presence. No typing. No edits/deletes.

## Current Phase Status
| Day | Theme | Status | Result |
|---|---|---|---|
| Day 1 | Conversation + monotonic ordering | COMPLETE | Deterministic 1:1 conversation identity and server-authoritative `seq` foundation |
| Day 2 | Ciphertext messaging pipeline | COMPLETE | `POST /relay/messages/send` stores ciphertext once with idempotent retry behavior |
| Day 3 | Device-scoped delivery state | COMPLETE | `delivery_state` created per target device with `delivered`/`read` lifecycle |
| Day 4 | Fan-out orchestration queue | NEXT | Queue delivery work per target device without server push |
| Day 5 | Deterministic resync + formal F4 gate | PENDING | Exact-range recovery and phase closeout |

## Day 1 - Conversation + Sequence Model
### Delivered
- Deterministic `1to1` conversation creation by sorted participant pair.
- Server-assigned monotonic `seq` only.
- Idempotent metadata insert path.
- Concurrency tests proving deterministic sequence assignment.

### Evidence
- [relay.service.ts](../../apps/api/src/modules/relay/relay.service.ts)
- [relay.service.spec.ts](../../apps/api/src/modules/relay/relay.service.spec.ts)
- [f4-day1-ordering.e2e.spec.ts](../../apps/api/test/f4-day1-ordering.e2e.spec.ts)
- [openapi.yaml](../../openapi.yaml)

### Gate
- PASS: sequence is monotonic under concurrent inserts.
- PASS: no client-provided ordering accepted.

## Day 2 - Ciphertext Messaging Pipeline
### Delivered
- `POST /relay/messages/send`
- Canonical base64 validation and `413` payload limit enforcement.
- Idempotent retry on `(sender_device_id, client_message_id)`.
- Same retry returns same `seq`; conflicting reuse returns `409`.
- Server remains crypto-blind and returns metadata only.

### Evidence
- [relay.controller.ts](../../apps/api/src/modules/relay/relay.controller.ts)
- [relay.service.ts](../../apps/api/src/modules/relay/relay.service.ts)
- [relay.service.spec.ts](../../apps/api/src/modules/relay/relay.service.spec.ts)
- [f4-day1-ordering.e2e.spec.ts](../../apps/api/test/f4-day1-ordering.e2e.spec.ts)
- [openapi.yaml](../../openapi.yaml)

### Gate
- PASS: ciphertext stored once, no plaintext/server-crypto path.
- PASS: retry-safe send semantics with deterministic `409`/idempotent replay behavior.

## Day 3 - Device-Scoped Delivery State
### Delivered
- `delivery_state` model per `(conversation_id, seq, target_device_id)`.
- Delivery rows created during message send after recipient-device resolution.
- `POST /relay/messages/delivered`
- `POST /relay/messages/read`
- Device-scoped isolation: one device state change never mutates sibling device rows.
- DB rule: `read_at` requires `delivered_at`.

### Evidence
- [schema.sql](../../schema.sql)
- [20260304150000_f4_day3_delivery_state.sql](../../apps/api/src/database/migrations/20260304150000_f4_day3_delivery_state.sql)
- [relay.service.ts](../../apps/api/src/modules/relay/relay.service.ts)
- [relay.controller.ts](../../apps/api/src/modules/relay/relay.controller.ts)
- [relay.service.spec.ts](../../apps/api/src/modules/relay/relay.service.spec.ts)
- [f4-day1-ordering.e2e.spec.ts](../../apps/api/test/f4-day1-ordering.e2e.spec.ts)

### Gate
- PASS: `read_at` cannot be persisted before `delivered_at`.
- PASS: retry does not recreate delivery rows.
- PASS: relay module coverage `100/100`.

## Day 4 - Server Fan-Out Orchestration
### Goal
Prepare delivery work for each target device after message storage without introducing push/WebSocket behavior.

### Frozen Requirements
- Store ciphertext once in `messages`.
- Create `fanout_queue` rows after message + delivery rows exist.
- No duplicate fanout rows on send retry.
- Pending fetch is device-scoped.
- `fanout_queue.delivered` is orchestration state only and must not mutate `delivery_state.delivered_at`.
- Server remains crypto-blind.

### Planned Tasks
- Add `fanout_queue` table with FK to `messages(conversation_id, seq)` and `ON DELETE CASCADE`.
- Add `FanoutService`:
  - `enqueueFanoutEvents(conversation_id, seq)`
  - `markFanoutDelivered(id)`
  - `fetchPendingFanout(target_wid, target_device_id)`
- Add `GET /relay/messages/pending`
- Join `messages + fanout_queue` and return ciphertext only for the requesting device.
- Enforce deterministic ordering and `LIMIT 100`.
- Update release/security docs and `tasks/f4.yaml`.

### Day 4 Gate
- All target devices get exactly one queue row per message.
- Retry produces no duplicate queue rows.
- Device A cannot fetch device B queue.
- Empty queue returns `[]`.

## Day 5 - Deterministic Resync + Formal F4 Gate
### Goal
Close the messaging-orchestrator phase with exact-range sync semantics and formal go/no-go evidence.

### Planned Tasks
- Implement deterministic sync/recovery endpoint(s) (`since` / `sync`) with strict range semantics.
- Add adversarial regressions for:
  - ordering gaps
  - replayed queue delivery
  - forged ack/read
  - duplicate retry after partial offline state
- Produce formal F4 gate document and manual checklist.

### Day 5 Gate
- Exact `from_seq+1..latest` return semantics.
- No duplicate/reordered replay during resync.
- Full CI green with required checks.

## F4 Architectural Invariants
- Server never decrypts ciphertext.
- Server never derives session/shared keys.
- Server never stores ratchet state.
- Ordering is server-authoritative.
- Delivery/read state is device-scoped.
- Fan-out queue is orchestration state, not read/delivery truth.

## Required Evidence For Every Remaining F4 Day
- Commit hash
- CI run link
- OpenAPI sync proof
- Migration/schema proof
- Security regression evidence
- Updated `tasks/f4.yaml`
- Updated release/security docs
