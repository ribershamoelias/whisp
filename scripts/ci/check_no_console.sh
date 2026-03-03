#!/usr/bin/env bash
set -euo pipefail

if rg -n "console\.(log|debug|info|warn|error)\(" apps/api/src apps/api/test; then
  echo "Forbidden console usage detected"
  exit 1
fi

echo "No forbidden console usage found"
