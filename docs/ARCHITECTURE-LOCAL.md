# Local architecture

This document is for humans **and** coding agents. It explains how the self-hosted stack differs from the original serverless NetKnife.

## Why this folder exists

The original NetKnife bill was driven by CloudFront, NAT, API Gateway, Lambdas, and Cognito. `NetKnife-App` is the same product you can run on a VM:

- Static UI from `frontend/dist` (Vite production build)
- One long-lived Node process instead of one Lambda per tool
- nginx as the only public listener (port 80)

```
┌──────────────┐     /              ┌─────────────┐
│   Browser    │───────────────────▶│    nginx    │
│              │     /api/*         │  :80        │
└──────────────┘                    └──────┬──────┘
                                           │ strip /api prefix
                                           ▼
                                    ┌─────────────┐
                                    │ Express     │
                                    │ :3001       │
                                    │ server/     │
                                    └──────┬──────┘
                                           │ handler(event)
                                           ▼
                                    ┌─────────────┐
                                    │ functions/* │
                                    │ (unchanged  │
                                    │  Lambdas)   │
                                    └─────────────┘
```

## Request path (example: DNS)

1. UI calls `apiPost('/dns', { name, type })` → `POST /api/dns` with `Authorization: Bearer local-token`.
2. nginx `location /api/` proxies to `http://127.0.0.1:3001/` so the Node app sees `POST /dns`.
3. `server/index.js` builds an API-Gateway-like event and calls `backend/functions/dns/index.js` `handler`.
4. Handler returns `{ statusCode, body }`. Express JSON-parses `body` and sends it to the browser.

## Auth

| Layer | Behavior |
|-------|----------|
| Frontend | `VITE_LOCAL_AUTH=true` → `DEV_BYPASS_AUTH`. Sign in writes `sessionStorage.dev_authenticated` and uses a fake user (`alexlux`). |
| API | Any Bearer token is enough. Claims are synthesized (`cognito:username` = `LOCAL_USERNAME`). |
| Billing UI | Stubbed usage response is grandfathered so remote tools are not paywalled. |

This is **not** production multi-user security. It is a private VM toolkit.

## What works without AWS

Works with outbound HTTPS only:

- DNS, RDAP, TLS, HTTP headers, reverse DNS, email-auth, traceroute, IP-API, ASN, BGP, PeeringDB, CVE (NVD/OSV), HIBP (k-anonymity), and most “call a public API” tools.

Need optional keys in `server/.env`:

- Shodan, VirusTotal, AbuseIPDB, GreyNoise, SecurityTrails, Censys, IPQS, Hunter, OpenAI (advisor).

Need AWS (will fail locally unless you wire credentials + tables):

- Kali Labs (EC2)
- Alarms (CloudWatch)
- Board / profile / reports / guides / scanners (DynamoDB)
- Stripe checkout / lab credits

## Cache

`backend/shared/netknife-common/cache.js`:

- No `CACHE_TABLE` **or** `LOCAL_MEMORY_CACHE=true` → in-process `Map` with TTL.
- Otherwise DynamoDB (original Lambda behavior).

Handlers that `require('@aws-sdk/client-dynamodb')` at the top of the file still need the SDK **installed** at the repo root (`package.json`) even when cache is memory-only. That is why `npm install` at the app root is part of `setup.sh`.

## Frontend build contract

`frontend/.env.production` is checked into this fork on purpose:

```
VITE_API_URL=/api
VITE_LOCAL_AUTH=true
```

Vite inlines these at `npm run build`. Serving an old `dist/` after changing env does nothing until you rebuild.

## Adding a tool (checklist)

1. Keep or add `backend/functions/<id>/index.js` with `exports.handler`.
2. Add `'/my-tool': 'my-tool'` to `ROUTES` in `server/index.js`.
3. Register the React tool in `frontend/src/tools/registry.tsx` (`kind: 'remote'`, `apiPost('/my-tool', …)`).
4. Run `./scripts/prepare-shared.sh` if the function `require('netknife-common')`.
5. Restart the API process. Rebuild frontend only if the UI changed.

## Env and ops

Full tables: [ENV.md](ENV.md). Failures: [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Deploy shapes

**Docker Compose:** `web` (nginx) + `api` (Node). nginx config: `deploy/nginx/docker.conf`. SPA files bind-mounted from `frontend/dist`.

**Bare VM:** `scripts/start-local.sh` or `deploy/systemd/netknife-api.service` + `deploy/nginx/netknife.conf` (`root /opt/netknife/frontend/dist`).
