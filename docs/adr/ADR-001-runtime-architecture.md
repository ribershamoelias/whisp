# ADR-001: Runtime Architecture

## Status
Accepted

## Decision
Use a modular monolith with NestJS modules:
- `auth`
- `identity`
- `spaces`
- `permissions`
- `relay`

Single deployable in Phase 1, strict module boundaries via interfaces.

## Rationale
- Fast delivery in startup mode.
- Lower ops overhead than microservices.
- Clear extraction path later by module boundary.

## Consequences
- Internal coupling must be controlled via module contracts.
- Performance hotspots can be split in later phases without API break.
