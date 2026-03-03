# ADR-002: Auth and Token Strategy

## Status
Accepted

## Decision
- Short-lived JWT access tokens.
- Refresh token rotation with `jti` invalidation.
- Refresh token reuse detection revokes token family.

## Rationale
- Limits token replay window.
- Supports mobile session continuity.

## Consequences
- Persistent token state is required.
- Integration tests must cover token reuse attack.
