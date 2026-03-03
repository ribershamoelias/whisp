# Phase 0 Definition of Done

## Required
- ADR-001/002/003 accepted and committed.
- System context and core sequence flow docs committed.
- Threat model v1 committed.
- Permission Enforcement Contract committed.
- Block during active session sequence committed.
- Log Redaction Policy committed.
- API and mobile scaffold committed.
- OpenAPI and SQL schema committed.
- CI config committed.

## Gate Checks
- CI pipeline green.
- API lint/test/build green.
- OpenAPI lints clean.
- No plaintext fields in relay API contract.
- Redaction policy is implemented in logging/tracing configuration and test-gated.
