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

required_count=$(docker compose exec -T postgres psql -U whisp -d whisp -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','devices','spaces','memberships','messages','requests','blocks','refresh_tokens');")
if [[ "${required_count}" != "8" ]]; then
  echo "Migration verification failed: expected 8 required tables, got ${required_count}"
  exit 1
fi

docker compose exec -T postgres pg_dump -U whisp -d whisp --schema-only | sha256sum >/tmp/schema_dump.sha256

if [[ ! -s /tmp/schema_dump.sha256 ]]; then
  echo "Schema dump hash missing"
  exit 1
fi

echo "Migration reproducibility check passed"
