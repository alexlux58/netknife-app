# Troubleshooting (local VM)

## `/health` lists only a handful of routes

The adapter **skips** a function if `require()` throws. Typical cause: missing AWS SDK at the **repo root**.

```bash
cd /path/to/NetKnife-App
npm install
./scripts/prepare-shared.sh
# restart the API
curl -s http://127.0.0.1:3001/health
```

A skipped handler answers `503` with `hint` in the JSON body.

## SPA loads but every tool says 401

The browser must send `Authorization: Bearer …`. Click **Sign in** on `/login` so `sessionStorage.dev_authenticated` is set. The token value can be anything (`local-token`); the API only checks that a Bearer header exists.

## SPA talks to the wrong host / CORS errors

You are serving an old `frontend/dist` built with a different `VITE_API_URL`. Rebuild after env changes.

## nginx 404 on client routes (`/tools/quien`)

`try_files` must fall back to `index.html`. Use `deploy/nginx/netknife.conf` or `docker.conf` as-is.

## DNS / RDAP / TLS work, Labs / Board / Alarms do not

Expected. Those handlers call EC2, DynamoDB, or CloudWatch. Lookup tools only need outbound HTTPS.

## “Blocked destination (private/reserved IP)”

`netknife-common/ssrf.js` refuses RFC1918, loopback, link-local, and similar. That is intentional on a VM too — do not weaken it to “scan my LAN” unless the operator explicitly asks.

## Docker: blank page on port 80

`frontend/dist` is bind-mounted. Run `./scripts/setup.sh` so `dist/` exists before `docker compose up`.
