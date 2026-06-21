# Configuration

Ghostwatch reads settings from `.env` (Docker / local dev), Kubernetes ConfigMap + Secret, or Helm values.

**Most installs:** run `npm run docker:init` or `docker:setup` and only change `NEXTAUTH_URL` / `APP_HOST` for production.

---

## Required (production)

| Variable | Example | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://…` | Where monitors, results, and users are stored. Docker Compose sets this automatically. |
| `NEXTAUTH_URL` | `https://monitor.company.com` | Public URL of the dashboard — used for login cookies and email links. |
| `APP_HOST` | `monitor.company.com` | Hostname of the dashboard. Custom status domains route separately from this host. |
| `AUTH_SECRET` | random string | Signs session cookies. Generate with `openssl rand -base64 32`. Setup scripts do this for you. |
| `CRON_SECRET` | random string | Protects `/api/cron/execute`. Must match on hub and any external cron caller. |

---

## Access control

Ghostwatch is **invite-only** after the owner account exists.

| Variable | Purpose |
| --- | --- |
| `OWNER_EMAIL` | If set before the first registration, only this email can become owner. |
| `AUTH_TRUST_HOST` | Default `true` — lets login work on your own hostname. Set `false` only if a proxy rewrites the Host header incorrectly. |

---

## Status pages

Built-in URL: `https://<APP_HOST>/s/<slug>`

**Custom domain flow:**

1. Dashboard → **Status Pages** → edit page → **Custom domains** → add hostname (e.g. `status.company.com`)
2. At your DNS provider, CNAME that hostname to `APP_HOST` (or `STATUS_CNAME_TARGET` if different)
3. Terminate HTTPS on that hostname (reverse proxy or Ingress)
4. Click **Check DNS** in the UI

| Variable | Purpose |
| --- | --- |
| `STATUS_CNAME_TARGET` | Hostname shown in DNS instructions. Defaults to `APP_HOST`. Use when the CNAME target differs from the dashboard host. |

Visitors on a custom domain only see that status page — not the dashboard or API.

---

## Monitoring regions

**Single server:** nothing to configure. Checks run from the same machine as the app.

**Multi-region:** one **hub** (dashboard + scheduler) sends work to **workers** in other locations. Each worker runs HTTP checks and writes results to the shared database.

| Variable | Where | Purpose |
| --- | --- | --- |
| `PROBE_ENDPOINTS` | Hub | Comma-separated `id\|https://worker-url\|Label` — tells the hub where to send checks. |
| `PROBE_WORKER=true` | Worker | Disables the dashboard scheduler on that instance; it only runs probes. |
| `PROBE_REGION` | Worker | Region id — must match an id from `PROBE_ENDPOINTS`. |
| `CRON_SECRET` | Hub + workers | Must be identical so workers accept probe requests. |
| `MONITORING_REGIONS` | Hub (optional) | Override display labels in the UI without changing probe URLs. |

Guides: [Docker multi-region](deploy/docker-multi-region.md) · [Kubernetes multi-region](deploy/kubernetes-multi-region.md)

---

## Data retention

Check results are stored for every probe run. To prevent unbounded database growth, GhostWatch purges old rows automatically.

| Variable | Default | Purpose |
| --- | --- | --- |
| `CHECK_RESULT_RETENTION_DAYS` | `90` | Delete `CheckResult` rows older than this many days. Set `0` to disable. |
| `ALLOW_PRIVATE_MONITOR_URLS` | unset | Set `true` only in local dev to allow monitors targeting `localhost` or private IPs. |

Retention runs once per hour (top of each UTC hour) during the scheduled cron tick.

Backups: [PostgreSQL backup guide](deploy/backups.md)

---

## Auth & email validation

GhostWatch validates that registration and invitation emails look like real, deliverable addresses.

| Variable | Default | Purpose |
| --- | --- | --- |
| `REQUIRE_EMAIL_VERIFICATION` | auto | Force verified email before dashboard access. Defaults to on when `RESEND_API_KEY` is set. |
| `SKIP_EMAIL_MX_CHECK` | unset | Set `true` in local dev if DNS lookups are unavailable. Format/disposable checks still apply. |

**What is blocked:**
- Placeholder local parts such as `test@`, `fake@`, `demo@`
- Disposable email providers (Mailinator, Yopmail, etc.)
- Domains that cannot receive mail (no MX or A records)

**Verification flow:** when email is configured, new users must click the link sent to their inbox before accessing the dashboard. Unverified users can resend from `/verify-pending`.

---

## Email (optional)

Without these, the app works — but invitations and email alerts are disabled.

```bash
RESEND_API_KEY=re_...
FROM_EMAIL="Ghostwatch <alerts@yourdomain.com>"
```

Restart the app after editing `.env`.

---

## OAuth (optional)

Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` or GitHub equivalents to enable social login. Password login works without them.

---

## Helm mapping

| `.env` | Helm value |
| --- | --- |
| `NEXTAUTH_URL` | `app.nextauthUrl` |
| `APP_HOST` | `app.host` |
| `PROBE_ENDPOINTS` | `app.probeEndpoints` |
| `PROBE_WORKER` | `app.probeWorker` |
| `AUTH_SECRET` | `secrets.authSecret` |
| `CRON_SECRET` | `secrets.cronSecret` |

Full list: [`charts/ghostwatch/values.yaml`](../charts/ghostwatch/values.yaml)

[← Getting started](GETTING-STARTED.md)
