# F1 Build Plan (Approved Scope)

## 1) Scope-Abgrenzung
### In Scope
- WID Generation
- Device Registration
- Public Key Registry
- JWT Access Token
- JWT verification middleware finalization
- Refresh Rotation mit Reuse-Detection
- Global Block (WID-level)
- Device Revocation
- Integration + Security Tests

### Out of Scope
- Messaging
- Signal Session Handling
- Space Creation / Requests / Public Groups
- Permission Engine Erweiterung/Refactor
- UX-Polish

## 2) Architekturfluss (Identity + Auth)
### Register
Controller -> IdentityService -> DB (`users`).

### Login
Controller -> AuthService -> DB verify -> issue access JWT + refresh token -> DB persist refresh metadata.

### Refresh (hard requirement)
Controller -> AuthService -> DB verify refresh token hash (constant-time compare) -> rotate token.

**Atomicity rule:**
Refresh rotation MUST run in one DB transaction:
1. Revoke old token (`jti`)
2. Insert new token (`new_jti`, `refresh_token_hash`, `family_id`)
3. Commit or rollback as one unit

### Device Add
Controller -> IdentityService -> DB (`devices`, unique `(wid, device_id)`).

### Device Revoke
Controller -> IdentityService -> DB revoke device -> AuthService revoke active refresh tokens for that device.

### Block Flow
Controller -> IdentityService -> DB (`blocks`) + BlockRegistry sync.

## 3) Kritischer Pfad
1. WID + key persistence hardening
2. JWT issuance
3. JWT verification middleware finalization
4. Refresh rotation (atomic transaction)
5. Device binding + revocation
6. Global block deterministic behavior
7. Integration tests
8. Attack tests

Rationale: erst Token-Validierungsgrundlage stabilisieren, dann Rotationssicherheit und Gerätesicherheit.

## 4) Sicherheitstests (mandatory)
1. Refresh token reuse attack
2. Token replay after rotation
3. Device revocation invalidates device tokens
4. Block after active session (fail-closed)
5. JWT expiry behavior
6. Invalid signature JWT rejected
7. Refresh token family compromise: old reused token invalidates family; newest token in same family must fail
8. Cross-device isolation / blast radius (design decision test)

## 5) Token Family Design (explicit)
Decision for F1: **per-device token family**.
- Each device has independent `family_id` chain.
- Reuse compromise invalidates only that device family.
- Other device families stay valid.

## 6) Datenbank-Constraints (hard)
- `users(wid)` PK
- `devices` FK to users, `UNIQUE(wid, device_id)`
- `blocks` FK + `UNIQUE(blocker_wid, blocked_wid)` + self-block check
- `refresh_tokens`:
  - `jti` UNIQUE
  - `family_id` NOT NULL
  - `refresh_token_hash` NOT NULL (no plaintext storage)
  - FK `wid -> users(wid)`
  - index `(wid, device_id)`
  - **partial index** active tokens:
    - `CREATE INDEX idx_refresh_active ON refresh_tokens(wid, device_id) WHERE revoked = false;`
  - optional family uniqueness invariant:
    - `UNIQUE(wid, device_id, family_id, jti)`

## 7) Cryptographic Handling Requirements
- Refresh token hashes via Argon2id or scrypt.
- Hash validation uses constant-time compare path.
- No plaintext refresh token in DB/logs/traces.

## 8) Definition of Done (F1)
- Critical integration flows green (register/login/refresh/device add/revoke/block)
- All 8 security tests green
- CI green on GitHub
- API contract finalized and synced with implementation
- No open TODO/FIXME in F1 files
- Coverage for auth+identity modules:
  - >= 90% line coverage
  - >= 90% branch coverage
- Manual attack checklist signed off
