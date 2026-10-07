# Run NetKnife on a VM (nginx + Node)

Human setup guide. For *why* it is built this way, see [docs/ARCHITECTURE-LOCAL.md](docs/ARCHITECTURE-LOCAL.md).

## What you get

- Same NetKnife UI (subnet calc, Quien, DNS, TLS, CVE, …)
- No Cognito login — click **Sign in**
- No AWS bill for API Gateway / CloudFront / NAT
- Lookup tools that call the public internet still need **outbound HTTPS** from the VM

## Requirements

- Node.js 20+
- nginx **or** Docker Compose
- Optional: third-party API keys (Shodan, VT, OpenAI, …)

## One-time setup

```bash
cd ~/Desktop/NetKnife-App
chmod +x scripts/*.sh
./scripts/setup.sh
```

That installs frontend + server + AWS SDK (needed so handlers *load*), copies `netknife-common` into function folders, and builds `frontend/dist`.

## Option A — Docker (easiest)

```bash
docker compose up --build
```

Browse to `http://<vm-ip>/`. Compose mounts `frontend/dist` into nginx; rebuild the frontend if you change UI or `frontend/.env.production`.

## Option B — nginx on the host

```bash
./scripts/start-local.sh          # API on 127.0.0.1:3001
# other terminal:
sudo mkdir -p /opt/netknife
sudo ln -sfn "$PWD/frontend/dist" /opt/netknife/frontend/dist
sudo cp deploy/nginx/netknife.conf /etc/nginx/sites-available/netknife
sudo ln -sf /etc/nginx/sites-available/netknife /etc/nginx/sites-enabled/netknife
sudo nginx -t && sudo systemctl reload nginx
```

Optional systemd unit: `deploy/systemd/netknife-api.service` (edit `WorkingDirectory` if the app is not under `/opt/netknife/server`).

## Sign in

You will see a local-mode banner. **Sign in** does not talk to AWS. The session user is `alexlux` (full tool access, including admin-gated pages).

## API keys (optional)

```bash
cp server/.env.example server/.env
# edit keys, then restart the API
```

Empty keys disable that integration; they do not crash the server.

## What will not work offline

| Feature | Why |
|---------|-----|
| Kali Labs | Launches EC2 in your AWS account |
| Alarms | Reads CloudWatch |
| Message board / reports / guides | DynamoDB tables |
| Stripe subscribe / lab credits | Stripe + billing tables |

## Smoke test (API only)

```bash
curl -s http://127.0.0.1:3001/health
curl -s -X POST http://127.0.0.1:3001/dns \
  -H 'authorization: Bearer local-token' \
  -H 'content-type: application/json' \
  -d '{"name":"example.com","type":"A"}'
```

Env reference: [docs/ENV.md](docs/ENV.md). If something fails: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Folder map

```
AGENTS.md                 ← rules for coding agents
README-LOCAL.md           ← this file
docs/ARCHITECTURE-LOCAL.md
frontend/                 Vite React app (build → dist/)
backend/functions/        Original Lambda handlers
backend/shared/           netknife-common (cache, SSRF, auth claims)
server/                   Express adapter (the only new runtime)
deploy/nginx/             Host + Docker nginx configs
deploy/docker/            API image
deploy/systemd/           Optional API unit
scripts/setup.sh          Install + build
scripts/start-local.sh    Run API in the foreground
scripts/prepare-shared.sh Copy netknife-common into functions
```
