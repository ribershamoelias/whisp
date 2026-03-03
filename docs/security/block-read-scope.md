# Block Read-Scope (F1 Day 4)

## Decision
Block enforcement in F1 is **write-scope fail-closed** and **read-scope allow** for identity metadata reads.

## Enforced deny (blocked)
- `POST /relay/messages`
- `POST /spaces/*` mutating actions
- Other mutating actions that target blocked WIDs

## Allowed reads
- `GET /identity/key-bundles/{wid}` remains readable, even for blocked pairs.

## Rationale
- Prevent communication and consent bypass immediately.
- Keep public-key retrieval available for protocol continuity and deterministic client behavior.

## Security note
Read-scope policy is explicit and tested; no implicit fallback behavior.
