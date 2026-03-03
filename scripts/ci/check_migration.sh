#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  docker compose down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose up -d postgres

for _ in {1..30}; do
  if docker compose exec -T postgres pg_isready -U whisp -d whisp >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker compose exec -T postgres psql -U whisp -d whisp -v ON_ERROR_STOP=1 -f /schema.sql >/tmp/migration_apply.log

required_count=$(docker compose exec -T postgres psql -U whisp -d whisp -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','devices','spaces','memberships','messages','echo_messages','requests','blocks','refresh_tokens');")
if [[ "${required_count}" != "9" ]]; then
  echo "Migration verification failed: expected 9 required tables, got ${required_count}"
  exit 1
fi

docker compose exec -T postgres pg_dump -U whisp -d whisp --schema-only | sha256sum >/tmp/schema_dump.sha256

if [[ ! -s /tmp/schema_dump.sha256 ]]; then
  echo "Schema dump hash missing"
  exit 1
fi

docker compose exec -T postgres psql -U whisp -d whisp -v ON_ERROR_STOP=1 -c "INSERT INTO users(wid, public_key) VALUES ('00000000-0000-0000-0000-000000000001', 'pub-1');" >/tmp/migration_user_seed.log

set +e
docker compose exec -T postgres psql -U whisp -d whisp -v ON_ERROR_STOP=1 -c "INSERT INTO refresh_tokens(wid, device_id, family_id, jti, refresh_token_hash, revoked, expires_at) VALUES ('00000000-0000-0000-0000-000000000001','device-A','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','plain-refresh-token',false,NOW() + INTERVAL '1 day');" >/tmp/migration_plaintext_insert.log 2>&1
plaintext_insert_status=$?
set -e
if [[ ${plaintext_insert_status} -eq 0 ]]; then
  echo "Plaintext persistence guard failed: DB accepted raw refresh token"
  exit 1
fi

docker compose exec -T postgres psql -U whisp -d whisp -v ON_ERROR_STOP=1 -c "INSERT INTO refresh_tokens(wid, device_id, family_id, jti, refresh_token_hash, revoked, expires_at) VALUES ('00000000-0000-0000-0000-000000000001','device-A','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','\$argon2id\$v=19\$m=65536,t=3,p=1\$abcdef\$uvwxyz',false,NOW() + INTERVAL '1 day');" >/tmp/migration_hash_insert.log

exact_match_count=$(docker compose exec -T postgres psql -U whisp -d whisp -t -A -c "SELECT count(*) FROM refresh_tokens WHERE refresh_token_hash = 'plain-refresh-token';")
if [[ "${exact_match_count}" != "0" ]]; then
  echo "Plaintext refresh token found in refresh_token_hash column"
  exit 1
fi

plaintext_column_count=$(docker compose exec -T postgres psql -U whisp -d whisp -t -A -c "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='echo_messages' AND column_name ILIKE '%plaintext%';")
if [[ "${plaintext_column_count}" != "0" ]]; then
  echo "Echo schema guard failed: plaintext column detected in echo_messages"
  exit 1
fi

docker compose exec -T postgres psql -U whisp -d whisp -v ON_ERROR_STOP=1 -c "INSERT INTO echo_messages(wid, device_id, message_id, ciphertext_blob) VALUES ('00000000-0000-0000-0000-000000000001','device-A','msg-1', decode('AAEC', 'base64'));" >/tmp/echo_insert.log

plaintext_match_count=$(docker compose exec -T postgres psql -U whisp -d whisp -t -A -c "SELECT count(*) FROM echo_messages WHERE encode(ciphertext_blob, 'escape') = 'this-is-plain-text-not-base64';")
if [[ "${plaintext_match_count}" != "0" ]]; then
  echo "Echo persistence guard failed: plaintext marker found in ciphertext_blob storage"
  exit 1
fi

set +e
docker compose exec -T postgres psql -U whisp -d whisp -v ON_ERROR_STOP=1 -c "INSERT INTO echo_messages(wid, device_id, message_id, ciphertext_blob) VALUES ('00000000-0000-0000-0000-000000000001','device-A','msg-1', decode('AAEC', 'base64'));" >/tmp/echo_duplicate_insert.log 2>&1
echo_duplicate_status=$?
set -e
if [[ ${echo_duplicate_status} -eq 0 ]]; then
  echo "Echo replay guard failed: duplicate (wid, device_id, message_id) insert was accepted"
  exit 1
fi

set +e
docker compose exec -T postgres psql -U whisp -d whisp -v ON_ERROR_STOP=1 -c "INSERT INTO echo_messages(wid, device_id, message_id, ciphertext_blob) VALUES ('00000000-0000-0000-0000-000000000001','device-A','msg-oversize', decode(repeat('AA', 65537), 'hex'));" >/tmp/echo_oversize_insert.log 2>&1
echo_oversize_status=$?
set -e
if [[ ${echo_oversize_status} -eq 0 ]]; then
  echo "Echo payload limit guard failed: oversized payload was accepted"
  exit 1
fi

echo "Migration reproducibility check passed"
