# ADR-003: Signal Integration Boundary

## Status
Accepted

## Decision
- Signal protocol operations run only on clients.
- Server stores and relays ciphertext blobs and public key material only.
- No private keys on server, no plaintext message handling.

## Rationale
- Enforces E2EE trust boundary.
- Reduces server-side cryptographic risk.

## Consequences
- Client key lifecycle handling is mandatory.
- Server APIs validate payload shape only, not decryptability.
