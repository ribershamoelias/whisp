# Permission Enforcement Contract (Phase 1)

## System of Record
`permissions` module is the only source of truth for allow/deny decisions.

## Contract
All mutating actions MUST call:
`authorize(actor_wid, action, resource_context) -> { allowed, deny_reason }`

If `allowed=false`, caller MUST fail closed and return `403` with deterministic `deny_reason`.

## Action Matrix
1. Auth Module
- Does not decide business permissions.
- Only validates identity/session.

2. Identity Module
- Calls `authorize` for block-sensitive actions when needed.
- Emits block updates; no distributed permission logic.

3. Spaces Module
- MUST call `authorize` before create/join/leave/role-change/request accept/reject.
- Request accept -> private space create must be pre-authorized.

4. Relay Module
- MUST call `authorize(send_message)` before persistence.
- No independent policy logic in relay.

5. Permissions Module
- Evaluates block, consent, membership, and role policy.
- Returns deterministic deny codes: `blocked | no_consent | role_denied | not_member`.

## Hard Rules
1. No module may bypass `authorize` for mutating operations.
2. No module may embed a second, divergent policy implementation.
3. Permission decisions are server-side authoritative.
4. Client pre-checks are advisory only.

## Required Integration Pattern
1. Controller receives request.
2. Service builds `resource_context`.
3. Service calls permissions `authorize`.
4. On allow, execute domain mutation.
5. On deny, return mapped error with deny reason.

## Compliance Checks
1. Route-to-policy mapping test: every mutating endpoint has an authorization call.
2. Policy parity tests: client pre-check never overrides server deny.
3. Block regression tests: block denies requests, role actions, and relay sends.
