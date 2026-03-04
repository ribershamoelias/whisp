# F3 Gate Check

## Meta
- Phase: `F3 - Signal 1:1 PreKey + Ratchet`
- Review Date: `2026-03-04`
- Reviewer: `Tech Lead / Security Lead`
- Threat Model Version: `v2-f3-1to1-prekey`
- Build Plan: `docs/release/f3-build-plan.md`
- Implementation Commit: `e478317697b9fcc452e47859577884e2ddae11ac`
- CI Run: `22663703552`
- CI URL: `https://github.com/ribershamoelias/whisp/actions/runs/22663703552`

## Gate Matrix
| Gate-ID | Beschreibung | Status | Evidenz | Reviewer Kommentar |
|---|---|---|---|---|
| G1 | Scope lock eingehalten (nur 1:1, kein Group/MLS) | PASS | `docs/release/f3-scope-freeze.md` | Kein Scope-Drift nachweisbar |
| G2 | PreKey-Infrastruktur atomar und replay-sicher | PASS | `apps/api/test/prekey-bundle.e2e.spec.ts` | Consume/depletion deterministisch |
| G3 | Client-Key-Lifecycle + TOFU + Key-change fail-closed | PASS | `apps/mobile/test/signal_prekey_provisioning_service_test.dart` | Identity-Wechsel blockiert |
| G4 | X3DH init + first-message decrypt | PASS | `apps/mobile/test/signal_session_service_test.dart` | Bootstrap stabil |
| G5 | Multi-device Isolation `(wid,device_id)` | PASS | `apps/mobile/test/signal_session_service_test.dart` | B1/B2 Isolation bestätigt |
| G6 | Ratchet persistence + out-of-order + desync checks | PASS | `apps/mobile/test/signal_session_service_test.dart` | Restart + skipped-keys grün |
| G7 | Hardening (rollback + key-reuse replay) | PASS | `apps/mobile/test/signal_session_service_test.dart` | Fail-closed Enforcement |
| G8 | CI vollständig grün (security/sast/contracts/api/mobile/migrations) | PASS | GitHub Actions Run | Alle required jobs grün |

## Global Stop Conditions
- Consent-Bypass möglich: `FAIL-CLOSED / PASS`
- Plaintext-Logging möglich: `FAIL-CLOSED / PASS`
- Identity-Key silent change möglich: `FAIL-CLOSED / PASS`
- Session-state rollback unentdeckt möglich: `FAIL-CLOSED / PASS`
- Message-key reuse/replay möglich: `FAIL-CLOSED / PASS`

## Entscheidung
- F3 STATUS: `GO`
- Begründung: Alle F3-Gates grün, inklusive adversarial hardening.
- Restrisiken: Operative Themen (Monitoring/alerting at scale), kein Architekturblocker.
- Freigabe: `Phase F4`
