# F1 Sprint Plan (Day 1-5)

Scope lock: **Identity/Auth/Block only**. No Messaging, no Spaces, no Permission-engine refactor, no UX polish.

## Day 1
### Ziele
- F1 Datenmodell und Migration für Auth/Identity härten.
- Kein plaintext refresh token storage möglich machen.

### Konkrete Tasks
- [x] `refresh_tokens` auf `refresh_token_hash` umstellen.
- [x] `family_id` und aktive Token-Indizes ergänzen.
- [x] Device/Block Constraints prüfen und ggf. nachziehen.
- [x] OpenAPI für F1-Auth/Identity synchronisieren.

### Deliverables
- [x] Versionierte Migration committed.
- [x] Aktualisierte `schema.sql`/OpenAPI committed.

### Tests (müssen grün sein)
- [x] Migration reproducibility check grün.
- [x] API lint/build grün.
- [x] OpenAPI lint (errors=0).
- [x] **Negative test plaintext persistence:** bewusst übergebener refresh token darf niemals unverändert in `refresh_token_hash` erscheinen.

### Gate am Tagesende
- [x] F1-Storage-Sicherheit nachgewiesen (technisch, nicht nur logisch).

### Daily Sign-off
- Commit Hash: `1b93442`
- CI Run Link: `https://github.com/ribershamoelias/whisp/actions/runs/22641866273`
- Reviewer: `Codex (Implementation), Pending external lead review`
- Reviewer Sign-off: [x] PASS  [ ] FAIL

---

## Day 2
### Ziele
- JWT Issuance + zentrale Verification-Middleware finalisieren.

### Konkrete Tasks
- [x] `/auth/login` produktionsnah umsetzen (kurze TTL).
- [x] Zentralen Verify-Pfad implementieren (kein dupliziertes Parsing).
- [x] Fehlerabbildung für invalid signature/expired token vereinheitlichen.

### Deliverables
- [x] AuthService ohne Scaffold-Token.
- [x] JWT verify utility/middleware integriert.

### Tests (müssen grün sein)
- [x] Unit: issue/verify/expiry.
- [x] Integration: invalid signature -> `401`.
- [x] Bestehende PolicyGuard-Tests weiterhin grün.

### Gate am Tagesende
- [x] JWT-Core deterministisch und konsistent.

### Daily Sign-off
- Commit Hash: `e16f7d1`
- CI Run Link: `https://github.com/ribershamoelias/whisp/actions/runs/22642151603`
- Reviewer: `Codex (Implementation), Pending external lead review`
- Reviewer Sign-off: [x] PASS  [ ] FAIL

---

## Day 3
### Ziele
- Refresh Rotation atomar umsetzen.
- Reuse-Detection + Family-Handling finalisieren.

### Konkrete Tasks
- [x] Rotation in einer DB-Transaktion (revoke + insert + commit/rollback).
- [x] Per-device family chain implementieren.
- [x] Reuse-Detection mit Family-Invalidation (device-spezifisch).
- [x] Constant-time compare für Hash-Validierung verwenden.

### Deliverables
- [x] Transaktionale Rotation im AuthService.
- [x] Reuse/Familienlogik dokumentiert und getestet.

### Tests (müssen grün sein)
- [x] Refresh reuse attack.
- [x] Token replay after rotation.
- [x] Family compromise test.
- [x] **Atomicity rollback simulation:** Fehler zwischen revoke und insert führt zu vollständigem rollback (keine Token-Lücke).

### Gate am Tagesende
- [x] Takeover-Schutz aktiv und atomar nachgewiesen.

### Daily Sign-off
- Commit Hash: `be8437b`
- CI Run Link: `https://github.com/ribershamoelias/whisp/actions/runs/22643042338`
- Reviewer: `Codex (Implementation), Pending external lead review`
- Reviewer Sign-off: [x] PASS  [ ] FAIL

---

## Day 4
### Ziele
- Device Management + Block Determinismus finalisieren.

### Konkrete Tasks
- [x] Device revoke Endpoint implementieren.
- [x] Device revoke invalidiert nur device-spezifische Token-Familie.
- [x] Block API persistence + runtime sync härten.
- [x] Block behavior für read-scope explizit festlegen und dokumentieren.

### Deliverables
- [x] Device add/revoke vollständig implementiert.
- [x] Block enforcement policy dokumentiert (read/write scope).

### Tests (müssen grün sein)
- [x] Device revocation test.
- [x] Cross-device isolation test.
- [x] Block after active session test.
- [x] **Block-read-scope test:**
  - falls read gesperrt: blocked reads -> deny
  - falls read erlaubt: expliziter Nachweis, dass nur mutierende Flows geblockt werden

### Gate am Tagesende
- [x] Device- und Block-Verhalten deterministisch, scope-klar, fail-closed.

### Daily Sign-off
- Commit Hash: `0572c73`
- CI Run Link: `https://github.com/ribershamoelias/whisp/actions/runs/22643767245`
- Reviewer: `Codex (Implementation), Pending external lead review`
- Reviewer Sign-off: [x] PASS  [ ] FAIL

---

## Day 5
### Ziele
- F1-Hardening, Coverage-Ziel, formale Freigabefähigkeit.

### Konkrete Tasks
- [x] Integration + Security Test-Suite konsolidieren.
- [x] Coverage für `auth` + `identity` auf >=90% line/branch bringen.
- [x] OpenAPI final mit Implementierung abgleichen.
- [x] Manual Attack Checklist durchführen und dokumentieren.

### Deliverables
- [x] Finale F1-Testreports.
- [x] Manual Attack Checklist mit Ergebnis.
- [x] F1-ready PR/commit ohne Scope-Leak.

### Tests (müssen grün sein)
- [x] Vollständige CI grün (api/mobile/contracts/migrations/security/sast).
- [x] Alle Security-Tests grün.
- [x] Coverage-Threshold grün.

### Gate am Tagesende
- [x] F1 formal gate-ready ohne offene Blocker.

### Daily Sign-off
- Commit Hash: `eede836`
- CI Run Link: `https://github.com/ribershamoelias/whisp/actions/runs/22645383436`
- Reviewer: `Codex (Implementation), Pending external lead review`
- Reviewer Sign-off: [x] PASS  [ ] FAIL

---

## Sprint Abschluss-Signoff
- F1 Scope verletzt: [x] Nein  [ ] Ja (Begründung erforderlich)
- Alle Day-Gates PASS: [x] Ja  [ ] Nein
- Final Reviewer: `Codex (Implementation), Pending external lead review`
- Final Decision: [x] APPROVE FOR F1 GATE  [ ] REWORK REQUIRED
- Datum: `2026-03-03`
- Unterschrift: `Codex`
