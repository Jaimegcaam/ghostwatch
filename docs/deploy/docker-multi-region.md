# Docker — multi-region

**Advanced setup.** Skip this unless you need checks to run from more than one geographic location.

## How it works

| Role | What it does |
| --- | --- |
| **Hub** | Dashboard, scheduler, dispatches checks to workers |
| **Worker** | Runs HTTP checks in its region, writes results to the shared database |

All instances share the same `DATABASE_URL` and `CRON_SECRET`. Each worker sets `PROBE_WORKER=true` and a unique `PROBE_REGION` id.

---

## Try it locally

```bash
npm run docker:setup          # creates .env if missing
npm run docker:regions:up
```

| URL | Role |
| --- | --- |
| http://localhost:3000 | Hub (dashboard) |
| http://localhost:3001 | Worker — region 1 |
| http://localhost:3002 | Worker — region 2 |

Open the hub, create a monitor, and pick multiple regions. Stop with:

```bash
docker compose -f docker-compose.regions.yml down
```

---

## Production

**Hub** — normal [Docker install](docker-single-server.md), plus in `.env`:

```bash
PROBE_ENDPOINTS="us-east-1|https://probe-va.corp.com|North Virginia,eu-south-2|https://probe-madrid.corp.com|Spain"
```

Format: `region-id|worker-public-url|Label shown in dashboard`, comma-separated.

**Each worker** — same Docker image, different env:

| Variable | Value |
| --- | --- |
| `PROBE_WORKER` | `true` |
| `PROBE_REGION` | Same id as in `PROBE_ENDPOINTS` (e.g. `eu-south-2`) |
| `DATABASE_URL` | Same as hub |
| `CRON_SECRET` | Same as hub |
| `NEXTAUTH_URL` / `APP_HOST` | Worker's public URL (needed for probe API routes) |

Workers do not need the dashboard exposed to users — only the hub URL is shared with your team.

Kubernetes equivalent → [kubernetes-multi-region.md](kubernetes-multi-region.md)

[← Deploy guides](README.md)
