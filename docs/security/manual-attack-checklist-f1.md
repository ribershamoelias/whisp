# Manual Attack Checklist - F1

Date: 2026-03-03
Scope: Identity/Auth/Block only

## Checklist
- [x] Refresh Token Reuse Attack
  Evidence: `apps/api/src/modules/auth/auth.service.spec.ts` (`reuses revoked token => family kill and no new token`)
- [x] Token Replay After Rotation
  Evidence: `apps/api/src/modules/auth/auth.service.spec.ts` (`rotates refresh token atomically with single active token` + replay rejection)
- [x] Device Revocation
  Evidence: `apps/api/test/device-revoke.e2e.spec.ts`
- [x] Block After Active Session
  Evidence: `apps/api/test/consent-enforcement.e2e.spec.ts`
- [x] JWT Expiry Behavior
  Evidence: `apps/api/src/common/auth/jwt-access.service.spec.ts` (`rejects expired token with deterministic 401`)
- [x] Invalid JWT Signature
  Evidence: `apps/api/test/auth-invalid-signature.e2e.spec.ts`
- [x] Refresh Token Family Compromise
  Evidence: `apps/api/src/modules/auth/auth.service.spec.ts` (`family kill` behavior)
- [x] Cross-Device Isolation
  Evidence: `apps/api/src/modules/auth/auth.service.spec.ts` and `apps/api/test/device-revoke.e2e.spec.ts`

## Result
- [x] PASS

Reviewer: Codex (implementation)
External security lead sign-off: PENDING
