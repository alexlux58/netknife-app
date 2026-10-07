#!/usr/bin/env bash
# One-shot install for a VM: frontend build, AWS SDK (handler load), shared module, Express.
# Safe to re-run. Does not start nginx or Docker.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Frontend dependencies"
cd frontend
npm install
echo "==> Frontend production build (local nginx auth)"
npm run build
cd "$ROOT"

echo "==> Shared AWS SDK (so handlers load without Lambda layers)"
npm install

echo "==> Shared Lambda module"
chmod +x scripts/prepare-shared.sh
./scripts/prepare-shared.sh

echo "==> API server dependencies"
cd server
npm install
cd "$ROOT"

echo "Setup complete."
echo "Start API:  cd server && npm start"
echo "Then point nginx at frontend/dist (see deploy/nginx/netknife.conf)"
echo "Or run:     docker compose up --build"
