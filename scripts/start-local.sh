#!/usr/bin/env bash
# Foreground API only (port 3001). Pair with host nginx or use docker compose for both.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export LOCAL_FULL_ACCESS="${LOCAL_FULL_ACCESS:-true}"
export LOCAL_MEMORY_CACHE="${LOCAL_MEMORY_CACHE:-true}"
export LOCAL_USERNAME="${LOCAL_USERNAME:-alexlux}"
export PORT="${PORT:-3001}"

if [ ! -d "$ROOT/frontend/dist" ]; then
  echo "frontend/dist missing — run scripts/setup.sh first"
  exit 1
fi

cd "$ROOT/server"
exec npm start
