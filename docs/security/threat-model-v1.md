# Threat Model v1 (Phase 1)

## Critical Assets
- WID identity records
- Device public key bundles
- Refresh token chain state
- Space membership and role state
- Encrypted message blobs

## High-Risk Threats
1. Refresh token replay
2. Unauthorized DM creation bypassing consent
3. Role escalation in spaces
4. Plaintext leakage through logs/traces
5. Block enforcement bypass in one endpoint

## Mandatory Mitigations
- Token rotation with family revocation.
- Central permission checks on every sensitive action.
- Role transition validation.
- Log redaction plus forbidden-pattern CI scan.
- Cross-flow integration tests for block policy.
