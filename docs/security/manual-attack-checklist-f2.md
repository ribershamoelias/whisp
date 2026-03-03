# Manual Attack Checklist - F2 (Echo Transport)

Date: 2026-03-04
Scope: Echo transport path only (`/relay/echo` + mobile echo adapter)

## Checklist
- [x] Replay Attack (single + concurrent duplicate submit)
  Evidence:
  - `apps/api/test/relay-echo.e2e.spec.ts`
  - `apps/api/test/relay-echo-hardening.e2e.spec.ts`
  - DB constraint `UNIQUE (wid, device_id, message_id)` in `schema.sql`

- [x] Oversize Payload Boundary
  Evidence:
  - `apps/api/test/relay-echo-hardening.e2e.spec.ts` (`65536` accepted, `65537` rejected)
  - DB check `octet_length(ciphertext_blob) <= 65536`

- [x] Malformed Base64 Handling
  Evidence:
  - `apps/api/test/relay-echo.e2e.spec.ts`
  - `apps/api/test/relay-echo-hardening.e2e.spec.ts`
  - Deterministic `400`, no `500`

- [x] Ciphertext Tampering (client-side fail-closed)
  Evidence:
  - `apps/mobile/test/echo_crypto_adapter_test.dart` (`tampered payload fails decryption`)

- [x] Ciphertext Opaqueness (server blindness)
  Evidence:
  - `scripts/ci/check_relay_no_crypto.sh` (crypto-import ban in relay module)
  - `apps/api/src/modules/relay/relay.service.ts` (no crypto operations)

- [x] Log Exfiltration (base64/binary payload)
  Evidence:
  - `apps/api/test/log-redaction.e2e.spec.ts`
  - `apps/api/src/common/logging/safe-logger.service.ts`

- [x] Metadata Surface Minimization
  Evidence:
  - `apps/api/test/relay-echo-hardening.e2e.spec.ts` (`minimal metadata only`)
  - `docs/security/f2-echo-metadata-leak-analysis.md`

- [x] Relay Coverage Gate Enforcement
  Evidence:
  - `apps/api/jest.config.ts` relay threshold (`>=90` lines/branches)
  - `npm run test:ci` report (relay currently 100/100)

## Result
- [x] PASS

Reviewer: Codex (implementation)
External security lead sign-off: PENDING
