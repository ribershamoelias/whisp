#!/usr/bin/env bash
set -euo pipefail

relay_dir="apps/api/src/modules/relay"

if rg -n "from ['\"](crypto|node:crypto|cryptography|libsodium|tweetnacl|signal-protocol)['\"]|require\(['\"](crypto|node:crypto|cryptography|libsodium|tweetnacl|signal-protocol)['\"]\)" "$relay_dir" >/tmp/relay_crypto_scan.log 2>&1; then
  echo "Relay crypto boundary violation: crypto import detected in relay module"
  cat /tmp/relay_crypto_scan.log
  exit 1
fi

echo "Relay crypto boundary check passed"
