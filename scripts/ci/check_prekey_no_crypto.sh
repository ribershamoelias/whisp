#!/usr/bin/env bash
set -euo pipefail

identity_dir="apps/api/src/modules/identity"

if rg -n "from ['\"](crypto|node:crypto|libsignal|signal-protocol|cryptography)['\"]|require\(['\"](crypto|node:crypto|libsignal|signal-protocol|cryptography)['\"]\)" "$identity_dir" >/tmp/prekey_crypto_scan.log 2>&1; then
  echo "PreKey server blindness violation: crypto/signal import detected in identity module"
  cat /tmp/prekey_crypto_scan.log
  exit 1
fi

echo "PreKey server blindness check passed"
