# Docker — multi-region

**Advanced.** Most installs only need [Getting started](../GETTING-STARTED.md) (single server).

One hub runs the dashboard; workers in other locations run the HTTP checks.

## Try it locally (free)

```bash
npm run docker:setup          # if no .env yet
npm run docker:regions:up
```

| URL | Role |
| --- | --- |
| http://localhost:3000 | Hub |
| http://localhost:3001 | Worker Virginia |
| http://localhost:3002 | Worker Spain |

Stop: `docker compose -f docker-compose.regions.yml down`

## Production

**Hub** — normal [Docker install](docker-single-server.md), plus in `.env`:

```bash
PROBE_ENDPOINTS="us-east-1|https://probe-va.corp.com|North Virginia,eu-south-2|https://probe-madrid.corp.com|Spain"
```

**Each worker** — same image, set `PROBE_WORKER=true`, `PROBE_REGION=<id>`, same `CRON_SECRET` and `DATABASE_URL` as the hub.

Kubernetes? → [kubernetes-multi-region.md](kubernetes-multi-region.md)

[← Deploy guides](README.md)
