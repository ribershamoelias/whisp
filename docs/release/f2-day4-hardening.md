# F2 Day 4 Hardening Report

Commit scope: relay transport hardening only.

## Completed
- Relay adversarial regression suite consolidated under `npm run test:security:relay`.
- CI guard added: `check_relay_no_crypto.sh` blocks any crypto import in relay module.
- Relay coverage gate enforced in Jest: `>=90%` lines and branches.
- Relay unit tests expanded for malformed inputs and missing-field fail-closed behavior.
- Relay controller unit tests added to verify deterministic delegation paths.
- Binary/base64 ciphertext log redaction regression extended.

## Security Assertions
- Server-side relay remains crypto-blind.
- Replay contract remains deterministic (`201` + `409` under concurrent duplicate submit).
- Payload boundary (`65536`) behavior remains deterministic.
- Metadata response surface remains minimal and fixed.

## Evidence
- CI workflow includes relay crypto-boundary scan and relay security regression command.
- `test/relay-echo-hardening.e2e.spec.ts`
- `test/log-redaction.e2e.spec.ts`
- `src/modules/relay/relay.service.spec.ts`
- `src/modules/relay/relay.controller.spec.ts`
