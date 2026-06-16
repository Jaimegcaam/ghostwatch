# Ghostwatch

Self-hosted uptime monitoring with public status pages. You run the app and database;
checks, alerts, and status pages stay under your control.

## Quick start (local)

```bash
npm run docker:init
open http://localhost:3000
```

The setup script creates `.env` with secrets and starts Postgres + the app. Register —
the first account becomes the **owner**. Then add a monitor under **Checks → New monitor**.

**Full walkthrough:** [Getting started](docs/GETTING-STARTED.md)

## What you need to configure

| When | What | Why |
| --- | --- | --- |
| **Local try-out** | Nothing extra | Defaults work on `localhost:3000` |
| **Production** | `NEXTAUTH_URL`, `APP_HOST` | Login and links must match your public URL |
| **Lock owner** | `OWNER_EMAIL` (optional) | Ensures only you can create the first account |
| **Email alerts** | `RESEND_API_KEY` (optional) | Without it, alerts stay in-app only |
| **Custom status domain** | DNS CNAME + dashboard | Serve `status.yourcompany.com` instead of `/s/slug` |
| **Multi-region checks** | `PROBE_ENDPOINTS` + workers | Run monitors from several locations |

Details: [Configuration](docs/CONFIGURATION.md)

## Deploy guides

| Setup | Guide |
| --- | --- |
| Docker (recommended) | [Getting started](docs/GETTING-STARTED.md) |
| Local dev (source code) | [Local development](docs/deploy/local-development.md) |
| Kubernetes | [Helm](docs/deploy/kubernetes-helm.md) · [YAML](docs/deploy/kubernetes-manifests.md) |
| Multi-region | [Docker](docs/deploy/docker-multi-region.md) · [K8s](docs/deploy/kubernetes-multi-region.md) |

## Features

- **Checks** — HTTP monitors in folders, with sustained-outage detection (a blip shows as *degraded*, not down)
- **Alerts** — Slack, Discord, webhooks, and email (email needs Resend)
- **Status pages** — public pages on `/s/<slug>` or your own domain
- **Teams** — invite-only; no public sign-up after the owner exists
- **Regions** — optional workers to probe from other countries

## More

- [Configuration reference](docs/CONFIGURATION.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

MIT License
