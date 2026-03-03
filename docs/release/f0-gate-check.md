# F0 Gate Check

## 1) Meta
- Phase: `F0 - Foundation`
- Review Date: `2026-03-03`
- Reviewer: `Codex (Internal Pre-Audit)`
- Review Status: `Completed - External CI Evidence Pending`
- Repo Commit Hash: `bb89bc8`
- CI Run Link: `PENDING (requires push to GitHub remote)`
- Threat Model Version: `v1` ([docs/security/threat-model-v1.md](../security/threat-model-v1.md))

## 2) Gate Matrix
| Gate-ID | Beschreibung | Status | Evidenz | Reviewer Kommentar |
|---|---|---|---|---|
| G1 | Architektur Freeze | PASS | [ADR-001](../adr/ADR-001-runtime-architecture.md), [ADR-002](../adr/ADR-002-auth-token-strategy.md), [ADR-003](../adr/ADR-003-signal-boundary.md), [System Context](../architecture/system-context-diagram.md), [Core Flows](../architecture/sequencing-core-flows.md), [Permission Contract](../architecture/permission-enforcement-contract.md) | Vollständig vorhanden. |
| G2 | Security Baseline | PASS | [Threat Model](../security/threat-model-v1.md), [Log Redaction Policy](../security/log-redaction-policy.md), [SafeLogger](../../apps/api/src/common/logging/safe-logger.service.ts), [Request Interceptor](../../apps/api/src/common/logging/request-logging.interceptor.ts), [Redaction E2E](../../apps/api/test/log-redaction.e2e.spec.ts), [CI Workflow](../../.github/workflows/ci.yml) | Redaction technisch erzwungen + Secret Scan + SAST Job in CI definiert. |
| G3 | Consent Enforcement | PASS | [PolicyGuard](../../apps/api/src/common/authz/policy.guard.ts), [RequiresPolicy Decorator](../../apps/api/src/common/authz/requires-policy.decorator.ts), [Relay Controller](../../apps/api/src/modules/relay/relay.controller.ts), [PolicyGuard E2E](../../apps/api/test/policy-guard.e2e.spec.ts), [Consent Enforcement E2E](../../apps/api/test/consent-enforcement.e2e.spec.ts), [Block Sequence](../architecture/block-during-active-session-sequence.md) | Fail-Closed bei fehlender Policy-Metadata; Relay-Flow policy-gated. |
| G4 | Auth + Token Strategy Freeze | PASS | [ADR-002](../adr/ADR-002-auth-token-strategy.md), [schema.sql](../../schema.sql) (`refresh_tokens.device_id`, `jti`, `revoked`) | Strategie eingefroren und als Implementationsvorgabe gesichert. |
| G5 | CI & Reproduzierbarkeit | PARTIAL | [CI Workflow](../../.github/workflows/ci.yml), [YAML Validation Script](../../scripts/ci/validate_yaml.sh), [Migration Check Script](../../scripts/ci/check_migration.sh), [Console Ban Script](../../scripts/ci/check_no_console.sh), [README Badge](../../README.md) | Alle Gates definiert, aber finaler Nachweis eines echten GitHub-Runs fehlt noch. |

## 3) F0 Gate Kriterien (verbindlich)

### G1 - Architektur Freeze
- ADR-001 vorhanden: PASS
- ADR-002 vorhanden: PASS
- ADR-003 vorhanden: PASS
- Architekturdiagramme vorhanden: PASS
- Sequenzdiagramme Kernflows vorhanden: PASS
- Permission Enforcement Contract vorhanden: PASS

Status: PASS
Evidenz: siehe Gate Matrix G1.

### G2 - Security Baseline
- Threat Model v1 vorhanden: PASS
- Log Redaction Policy vorhanden: PASS
- Redaction technisch erzwungen: PASS
- Secret Scan in CI: PASS
- SAST aktiviert: PASS

Status: PASS
Evidenz: siehe Gate Matrix G2.

### G3 - Consent Enforcement
- Relay ruft `authorize()` zwingend auf: PASS
- Kein Messaging-Endpunkt ohne Policy-Gate: PASS
- Block wirkt global: PASS (policy + block registry + e2e relay deny)
- Block bei aktiver Session fail-closed dokumentiert: PASS

Status: PASS
Evidenz: siehe Gate Matrix G3.

### G4 - Auth + Token Strategy Freeze
- JWT kurzlebig: PASS (ADR)
- Refresh Rotation mit Reuse-Detection: PASS (ADR)
- Device Binding vorhanden: PASS (Schema/Design)
- Revocation dokumentiert: PASS (ADR/Schema)

Status: PASS
Evidenz: siehe Gate Matrix G4.

### G5 - CI & Reproduzierbarkeit
- CI grün (echter Run): FAIL (extern ausstehend)
- Lint + Test + Build enforced: PASS
- OpenAPI validiert: PASS
- YAML validiert: PASS
- Migration reproducible: PASS (CI job + script vorhanden)

Status: PARTIAL
Evidenz: siehe Gate Matrix G5.

## 4) Global Stop Condition Check
- Consent-Bypass möglich? PASS
  - Begründung: Mutationen sind per globalem Guard fail-closed policy-enforced.
- Plaintext-Logging möglich? PASS
  - Begründung: `SafeLogger` redaktiert sensitive Felder + e2e Redaction Test + CI console ban.
- Block inkonsistent? PASS
  - Begründung: Block-Entscheidung zentral in Permission-Authorize-Pfad; Relay blockt im Testfall.
- Policy-Drift möglich? PASS (kontrolliertes Restrisiko)
  - Begründung: Server ist autoritativ, Guard erzwingt Policy. Client-Parity-Tests folgen in F1/F4.

## 5) Gate-Entscheidung
- F0 STATUS: NO-GO (bis externer CI-Nachweis vorliegt)
- Begründung:
  - Alle vier technischen Blocker sind im Code/CI umgesetzt.
  - Finaler Auditpunkt "echter GitHub-Run mit URL" kann ohne Remote-Push nicht abgeschlossen werden.
- Rest-Risiken:
  - Operativ: fehlender externer CI-Laufnachweis.
  - Kein architektonischer Blocker mehr offen.
- Freigabe für F1:
  - Erteilen nach 1 grünem GitHub-Workflow-Run mit Link auf Commit `bb89bc8`.

Unterschrift (Tech Lead): `PENDING`
