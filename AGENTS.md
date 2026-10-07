# Agent context — NetKnife-App (self-hosted)

Read this before editing anything in this tree. This is **not** the AWS serverless repo.

## What this project is

`NetKnife-App` is a **local/VM fork** of NetKnife. The original product (`~/Desktop/NetKnife`) is API Gateway + Lambda + Cognito + CloudFront. This copy keeps the same React tools and the same Lambda `handler(event)` functions, then runs them behind **nginx + one Node process**.

Do **not** add Terraform, Cognito Hosted UI, or CloudFront here unless the user explicitly asks to reconnect AWS.

## Architecture (one sentence)

Browser → nginx (`/` SPA, `/api/*` reverse proxy) → Express (`server/index.js`) → `backend/functions/<name>/index.js` `handler()`.

## Invariants

1. **Do not rewrite tool handlers into Express routers.** Add a line to `ROUTES` in `server/index.js` and keep `exports.handler`.
2. **Lambda event shape must stay compatible.** Handlers read `event.body` (JSON string) and `event.requestContext.authorizer.jwt.claims`.
3. **Frontend talks to same-origin `/api`.** `VITE_API_URL=/api` is baked at build time. Changing it requires `cd frontend && npm run build`.
4. **Local auth is intentional.** `VITE_LOCAL_AUTH=true` skips Cognito. The API treats any `Authorization: Bearer *` as the local user (`LOCAL_USERNAME`, default `alexlux`).
5. **Billing is stubbed.** `POST /billing` `{ action: "usage" }` returns grandfathered/full access unless `LOCAL_FULL_ACCESS=false`.
6. **Cache is in-memory** when `CACHE_TABLE` is unset or `LOCAL_MEMORY_CACHE=true`. Do not require DynamoDB for lookup tools.
7. **AWS-only features stay optional.** Labs (EC2), Alarms (CloudWatch), Board/Reports/Guides (DynamoDB), Stripe checkout will fail or stay empty without AWS. That is expected.

## Where to change things

| Goal | File |
|------|------|
| New HTTP tool route | `server/index.js` `ROUTES` + `backend/functions/<id>/` |
| New UI tool | `frontend/src/tools/registry.tsx` + tool component |
| Auth / who the local user is | `frontend/src/lib/auth.ts`, `LOCAL_*` env, `server/index.js` `localClaims()` |
| nginx paths | `deploy/nginx/netknife.conf` (host) or `docker.conf` (Compose) |
| Install / build | `scripts/setup.sh` |
| Agent + human docs | `AGENTS.md`, `docs/ARCHITECTURE-LOCAL.md`, `README-LOCAL.md` |

## Handler contract (copy this)

```js
exports.handler = async (event) => {
  const body = event.body ? JSON.parse(event.body) : {}
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) }
}
```

Shared helpers live in `backend/shared/netknife-common` and are copied into each function’s `node_modules` by `scripts/prepare-shared.sh`.

## Do not

- Point this frontend at the destroyed AWS API.
- Enable Cognito in `.env.production` for the VM build.
- Commit secrets. API keys go in `server/.env` (gitignored if you add it).
- Assume DynamoDB tables exist.

## Environment (read `docs/ENV.md`)

- **Vite** (`VITE_*`) is compile-time. Rebuild `frontend/dist` after changes.
- **Node** (`LOCAL_*`, API keys) is process-time. Restart `server/index.js`.
- Default local user is `alexlux` so admin-gated pages stay reachable on a private VM.

## Pitfalls agents hit

- Editing `backend/shared/netknife-common/*` does nothing until `./scripts/prepare-shared.sh` copies it into each function’s `node_modules`.
- A handler that `require('@aws-sdk/...')` at module top will be **skipped at boot** if the SDK is missing from the **repo-root** `package.json` install — even if that handler never calls AWS.
- `POST /billing` is intercepted for `action=usage`. Do not “fix” that by deleting the stub; the SPA will lock remote tools.
- nginx `proxy_pass http://127.0.0.1:3001/;` (trailing slash) **strips** `/api`. The Express path is `/dns`, not `/api/dns`.
- SSRF guards in `ssrf.js` stay on. Do not open private-IP lookups unless the user asks.

## More docs

| File | Audience |
|------|----------|
| `README.md` | Entry |
| `README-LOCAL.md` | Human VM setup |
| `docs/ARCHITECTURE-LOCAL.md` | Design |
| `docs/ENV.md` | Every env var |
| `docs/TROUBLESHOOTING.md` | Common failures |
| `.cursor/rules/netknife-app.mdc` | Always-on Cursor rule |

## Test locally

```bash
curl -s http://127.0.0.1:3001/health
curl -s -X POST http://127.0.0.1:3001/dns \
  -H 'authorization: Bearer local-token' \
  -H 'content-type: application/json' \
  -d '{"name":"example.com","type":"A"}'
```
