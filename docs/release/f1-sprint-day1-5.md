# F1 Sprint Plan (Day 1-5)

Scope lock: **Identity/Auth/Block only**. No Messaging, no Spaces, no Permission-engine refactor, no UX polish.

## Day 1
### Ziele
- F1 Datenmodell und Migration für Auth/Identity härten.
- Kein plaintext refresh token storage möglich machen.

### Konkrete Tasks
- [ ] `refresh_tokens` auf `refresh_token_hash` umstellen.
- [ ] `family_id` und aktive Token-Indizes ergänzen.
- [ ] Device/Block Constraints prüfen und ggf. nachziehen.
- [ ] OpenAPI für F1-Auth/Identity synchronisieren.

### Deliverables
- [ ] Versionierte Migration committed.
- [ ] Aktualisierte `schema.sql`/OpenAPI committed.

### Tests (müssen grün sein)
- [ ] Migration reproducibility check grün.
- [ ] API lint/build grün.
- [ ] OpenAPI lint (errors=0).
- [ ] **Negative test plaintext persistence:** bewusst übergebener refresh token darf niemals unverändert in `refresh_token_hash` erscheinen.

### Gate am Tagesende
- [ ] F1-Storage-Sicherheit nachgewiesen (technisch, nicht nur logisch).

### Daily Sign-off
- Commit Hash:
- CI Run Link:
- Reviewer:
- Reviewer Sign-off: [ ] PASS  [ ] FAIL

---

## Day 2
### Ziele
- JWT Issuance + zentrale Verification-Middleware finalisieren.

### Konkrete Tasks
- [ ] `/auth/login` produktionsnah umsetzen (kurze TTL).
- [ ] Zentralen Verify-Pfad implementieren (kein dupliziertes Parsing).
- [ ] Fehlerabbildung für invalid signature/expired token vereinheitlichen.

### Deliverables
- [ ] AuthService ohne Scaffold-Token.
- [ ] JWT verify utility/middleware integriert.

### Tests (müssen grün sein)
- [ ] Unit: issue/verify/expiry.
- [ ] Integration: invalid signature -> `401`.
- [ ] Bestehende PolicyGuard-Tests weiterhin grün.

### Gate am Tagesende
- [ ] JWT-Core deterministisch und konsistent.

### Daily Sign-off
- Commit Hash:
- CI Run Link:
- Reviewer:
- Reviewer Sign-off: [ ] PASS  [ ] FAIL

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
