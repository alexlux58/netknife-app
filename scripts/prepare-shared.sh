#!/usr/bin/env bash
# Copy backend/shared/netknife-common into each function that require('netknife-common').
# Lambdas used a layer; locally there is no layer, so each folder gets a copy.
# Re-run after you edit cache.js / ssrf.js / auth.js.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHARED_SRC="$ROOT/backend/shared/netknife-common"
FUNCTIONS_DIR="$ROOT/backend/functions"

if [ ! -f "$SHARED_SRC/package.json" ]; then
  echo "Error: shared module not found at $SHARED_SRC" >&2
  exit 1
fi

copy_shared() {
  local dest="$1"
  rm -rf "$dest"
  mkdir -p "$(dirname "$dest")"
  cp -R "$SHARED_SRC/." "$dest"
}

count=0
while IFS= read -r fn_dir; do
  fn="$(basename "$fn_dir")"
  # Match require('netknife-common') and deep paths like require('netknife-common/ssrf')
  if grep -rql "require(['\"]netknife-common" "$fn_dir"/*.js 2>/dev/null; then
    echo "==> Linking netknife-common: $fn"
    copy_shared "$fn_dir/node_modules/netknife-common"
    count=$((count + 1))
  fi
done < <(find "$FUNCTIONS_DIR" -mindepth 1 -maxdepth 1 -type d | sort)

echo "Prepared netknife-common for ${count} function(s)."
