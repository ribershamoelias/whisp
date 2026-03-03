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
- [ ] Rotation in einer DB-Transaktion (revoke + insert + commit/rollback).
- [ ] Per-device family chain implementieren.
- [ ] Reuse-Detection mit Family-Invalidation (device-spezifisch).
- [ ] Constant-time compare für Hash-Validierung verwenden.

### Deliverables
- [ ] Transaktionale Rotation im AuthService.
- [ ] Reuse/Familienlogik dokumentiert und getestet.

### Tests (müssen grün sein)
- [ ] Refresh reuse attack.
- [ ] Token replay after rotation.
- [ ] Family compromise test.
- [ ] **Atomicity rollback simulation:** Fehler zwischen revoke und insert führt zu vollständigem rollback (keine Token-Lücke).

### Gate am Tagesende
- [ ] Takeover-Schutz aktiv und atomar nachgewiesen.

### Daily Sign-off
- Commit Hash:
- CI Run Link:
- Reviewer:
- Reviewer Sign-off: [ ] PASS  [ ] FAIL

---

## Day 4
### Ziele
- Device Management + Block Determinismus finalisieren.

### Konkrete Tasks
- [ ] Device revoke Endpoint implementieren.
- [ ] Device revoke invalidiert nur device-spezifische Token-Familie.
- [ ] Block API persistence + runtime sync härten.
- [ ] Block behavior für read-scope explizit festlegen und dokumentieren.

### Deliverables
- [ ] Device add/revoke vollständig implementiert.
- [ ] Block enforcement policy dokumentiert (read/write scope).

### Tests (müssen grün sein)
- [ ] Device revocation test.
- [ ] Cross-device isolation test.
- [ ] Block after active session test.
- [ ] **Block-read-scope test:**
  - falls read gesperrt: blocked reads -> deny
  - falls read erlaubt: expliziter Nachweis, dass nur mutierende Flows geblockt werden

### Gate am Tagesende
- [ ] Device- und Block-Verhalten deterministisch, scope-klar, fail-closed.

### Daily Sign-off
- Commit Hash:
- CI Run Link:
- Reviewer:
- Reviewer Sign-off: [ ] PASS  [ ] FAIL

---

## Day 5
### Ziele
- F1-Hardening, Coverage-Ziel, formale Freigabefähigkeit.

### Konkrete Tasks
- [ ] Integration + Security Test-Suite konsolidieren.
- [ ] Coverage für `auth` + `identity` auf >=90% line/branch bringen.
- [ ] OpenAPI final mit Implementierung abgleichen.
- [ ] Manual Attack Checklist durchführen und dokumentieren.

### Deliverables
- [ ] Finale F1-Testreports.
- [ ] Manual Attack Checklist mit Ergebnis.
- [ ] F1-ready PR/commit ohne Scope-Leak.

### Tests (müssen grün sein)
- [ ] Vollständige CI grün (api/mobile/contracts/migrations/security/sast).
- [ ] Alle Security-Tests grün.
- [ ] Coverage-Threshold grün.

### Gate am Tagesende
- [ ] F1 formal gate-ready ohne offene Blocker.

### Daily Sign-off
- Commit Hash:
- CI Run Link:
- Reviewer:
- Reviewer Sign-off: [ ] PASS  [ ] FAIL

---

## Sprint Abschluss-Signoff
- F1 Scope verletzt: [ ] Nein  [ ] Ja (Begründung erforderlich)
- Alle Day-Gates PASS: [ ] Ja  [ ] Nein
- Final Reviewer:
- Final Decision: [ ] APPROVE FOR F1 GATE  [ ] REWORK REQUIRED
- Datum:
- Unterschrift:
