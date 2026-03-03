#!/usr/bin/env bash
set -euo pipefail

if rg -n "TODO|FIXME" apps/api/src apps/api/test openapi.yaml schema.sql; then
  echo "Forbidden TODO/FIXME markers found"
  exit 1
fi

echo "No TODO/FIXME markers found"
