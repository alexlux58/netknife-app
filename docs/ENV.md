# Environment variables

Two layers. Vite vars are **baked into `frontend/dist` at build time**. Server vars are read at **API process start**.

## Frontend (`frontend/.env.production`)

Checked in for this VM fork. After any change: `cd frontend && npm run build`.

| Variable | Required value on a VM | Why |
|----------|------------------------|-----|
| `VITE_API_URL` | `/api` | Same-origin. nginx strips `/api` and proxies to Node. |
| `VITE_LOCAL_AUTH` | `true` | Skips Cognito in a **production** Vite build. |
| `VITE_DEV_BYPASS_AUTH` | `true` | Extra safety if someone serves a leftover DEV build. |
| `VITE_COGNITO_*` / `VITE_OIDC_*` | empty | Must stay empty so the SPA never redirects to a dead user pool. |
| `VITE_SOCIAL_IDPS` | empty | Hides Google/GitHub/etc. buttons when no IdPs exist. |
| `VITE_REGION` | `local` | Unused when local auth is on. |

Do not set `VITE_API_URL` to an `https://….execute-api….amazonaws.com` URL. That stack was destroyed.

## API (`server/.env` or systemd / Compose)

Copy from `server/.env.example`. Restart Node after edits.

| Variable | Default | Meaning |
|----------|---------|---------|
| `PORT` | `3001` | Bind port. nginx must match. |
| `LOCAL_FULL_ACCESS` | `true` | Stub `POST /billing` `{action:usage}` as grandfathered. Set `false` only if you wired real billing tables. |
| `LOCAL_MEMORY_CACHE` | `true` | Force in-memory cache even if `CACHE_TABLE` is set. |
| `LOCAL_USERNAME` | `alexlux` | Injected JWT `username` / `cognito:username`. Admin-gated UI uses this. |
| `LOCAL_USER_SUB` | `local-user` | Injected `sub`. |
| `LOCAL_EMAIL` / `LOCAL_NAME` | local placeholders | Profile claims only. |
| `CACHE_TABLE` | unset | If set **and** `LOCAL_MEMORY_CACHE` is not `true`, handlers write DynamoDB. |
| `CACHE_TTL_SECONDS` | handler-specific | Some tools read this; others hard-code TTL. |

Third-party keys use the **same names as the original Lambdas**. Empty = that integration returns its usual “not configured” error. Examples: `SHODAN_API_KEY`, `VIRUSTOTAL_API_KEY`, `ABUSEIPDB_API_KEY`, `OPENAI_API_KEY`, `NVD_API_KEY`.

Never commit `server/.env`.
