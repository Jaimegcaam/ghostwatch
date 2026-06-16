# Docker — single server

One machine runs the app, Postgres, and the check scheduler. This is the recommended production setup for most teams.

## Install

```bash
npm run docker:init
```

Or without Node: `./scripts/docker-setup.sh && docker compose up -d`

The setup script writes `.env` with:

- `AUTH_SECRET` — session signing
- `CRON_SECRET` — protects the scheduler endpoint
- `DATABASE_URL` — connection to the bundled Postgres
- `NEXTAUTH_URL` / `APP_HOST` — default to `http://localhost:3000` for local use

---

## Production

Edit `.env` **before** `docker compose up -d`:

```bash
NEXTAUTH_URL=https://monitor.yourcompany.com
APP_HOST=monitor.yourcompany.com
OWNER_EMAIL=you@yourcompany.com    # optional
```

| Setting | Why |
| --- | --- |
| `NEXTAUTH_URL` | Must match the URL users type in the browser (with `https://`). |
| `APP_HOST` | Hostname only — separates dashboard traffic from custom status-page domains. |
| HTTPS reverse proxy | Ghostwatch listens on port 3000; terminate TLS with Caddy, nginx, Traefik, etc. |

Checks run automatically inside the container — no external cron job required.

---

## Updates and teardown

```bash
git pull && docker compose build app && docker compose up -d   # update
docker compose down        # stop, keep database
docker compose down -v     # stop and delete all data
```

[Getting started](../GETTING-STARTED.md) · [Multi-region](docker-multi-region.md)
