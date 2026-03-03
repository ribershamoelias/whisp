# Migrations

Versioned SQL migrations for WHISP API.

- `20260303100000_init.sql` bootstraps initial Phase 1 schema.
- `20260303230000_f1_day1_storage_hardening.sql` hardens refresh-token storage.
- `20260304010000_f2_day1_echo_storage.sql` adds ciphertext-only echo storage constraints.
- `20260304093000_f3_day1_prekey_infra.sql` adds prekey infrastructure tables and constraints.
