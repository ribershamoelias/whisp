# MASTER PROMPT - WHISP F4 Day 4: Server Fan-Out Orchestrator

You are working on the WHISP secure messaging backend.

Current repository status:
- F0 complete: architecture + CI security gates
- F1 complete: identity/auth/device revoke
- F2 complete: ciphertext relay
- F3 complete: Signal PreKey + Double Ratchet
- F4 Day 1 complete: conversation model + monotonic seq
- F4 Day 2 complete: ciphertext messaging endpoint
- F4 Day 3 complete: device-scoped `delivery_state` tracking

Your task is to implement **F4 Day 4: Server Fan-Out Orchestration Layer**.

## Goal
Create a fan-out orchestration layer that prepares delivery work for each target device.

Important:
- server remains crypto blind
- ciphertext stored once
- fan-out only creates delivery events
- no websocket/push yet
- no client sync yet

## Architecture
Current flow:
```text
client encrypt
-> POST /relay/messages/send
-> server assigns seq
-> message stored
-> delivery_state rows created
```

Day 4 flow:
```text
message stored
-> lookup delivery_state rows
-> enqueue fanout_queue rows
```

## Database Addition
Add:
```sql
fanout_queue (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL,
  seq BIGINT NOT NULL,
  target_wid UUID NOT NULL,
  target_device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered BOOLEAN NOT NULL DEFAULT FALSE
)
```

Required constraints:
- `UNIQUE(conversation_id, seq, target_device_id)`
- `FOREIGN KEY (conversation_id, seq) REFERENCES messages(conversation_id, seq) ON DELETE CASCADE`

## Server Flow Change
After message is stored:
```text
store message
create delivery rows
create fanout_queue rows
```

Important:
- retry must not duplicate queue rows
- `fanout_queue.delivered` is queue/orchestration state only
- queue delivery marker must not mutate `delivery_state.delivered_at`

## New Service
Create:
- `fanout.service.ts`

Responsibilities:
- `enqueueFanoutEvents(conversation_id, seq)`
- `markFanoutDelivered(id)`
- `fetchPendingFanout(target_wid, target_device_id)`

## New Endpoint
Add:
- `GET /relay/messages/pending`

Query:
- `target_wid`
- `target_device_id`

Response:
```json
[
  {
    "conversation_id": "uuid",
    "seq": 1,
    "ciphertext": "base64",
    "created_at": "timestamp"
  }
]
```

Server must:
- join `messages + fanout_queue`
- return only pending rows where `fanout_queue.delivered = false`
- sort deterministically
- `LIMIT 100`

Recommended ordering:
```sql
ORDER BY created_at, seq
```
If another order is chosen, it must be documented and tested.

## Important Rules
Server still must:
- never decrypt
- never derive keys
- never access ratchet state

Server only transports ciphertext.

## Tests
Add:

### fanout creation
```text
send message
-> fanout rows created
```

### retry
```text
retry send
-> no duplicate fanout rows
```

### pending fetch
```text
device fetch pending
-> returns correct messages
```

### device isolation
```text
device A fetch
device B fetch
```
must return different queues.

### empty queue
```text
device fetch
-> []
```

### queue truth separation
```text
markFanoutDelivered(id)
-> fanout_queue.delivered changes
-> delivery_state.delivered_at unchanged
```

## OpenAPI
Add:
- `GET /relay/messages/pending`

Document request query params and response schema.

## Documentation Update
Update:
- `docs/release/f4-build-plan.md`
- `docs/security/f4-threat-model-messaging-layer.md`
- `tasks/f4.yaml`

Add explicit section:
- `Fan-Out Orchestration Layer`

Explain:
- ciphertext stored once
- `delivery_state` tracks delivery/read truth
- `fanout_queue` schedules device delivery work

## Expected Commits
```text
feat(f4-day4): add server fanout orchestration layer

test(api): add fanout queue and pending message tests

docs(f4): document fanout architecture
```

## Result
After F4 Day 4, the backend must support:
- ciphertext messaging
- device-scoped delivery state
- fanout orchestration
- pending message retrieval

## Non-Goals
Do not implement:
- websocket or push delivery
- sync/since recovery endpoints
- attachments
- reactions
- presence
- typing indicators
- groups
