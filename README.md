# NetKnife App

Self-hosted NetKnife for a **VM behind nginx**. This is not the AWS CloudFront/Lambda stack.

| I am a… | Start here |
|---------|------------|
| Human setting up a VM | [README-LOCAL.md](README-LOCAL.md) |
| Human / agent learning the design | [docs/ARCHITECTURE-LOCAL.md](docs/ARCHITECTURE-LOCAL.md) |
| Coding agent editing this repo | [AGENTS.md](AGENTS.md) |

```bash
./scripts/setup.sh
docker compose up --build
# open http://<vm-ip>/  →  Sign in (no Cognito)
```

Without Docker: `./scripts/start-local.sh` then install `deploy/nginx/netknife.conf`.

Further reading: [docs/ENV.md](docs/ENV.md) · [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
