# Getting started

Install Ghostwatch with Docker and create your first monitor.

**You need:** [Docker](https://docs.docker.com/get-docker/) (Docker Desktop on Mac/Windows is fine).

---

## Install

```bash
npm run docker:init
```

This script:

- Creates `.env` from `.env.docker.example`
- Generates `AUTH_SECRET` and `CRON_SECRET` (needed for login and scheduled checks)
- Sets `DATABASE_URL` for the bundled Postgres
- Starts the stack with `docker compose up -d`

**No Node.js?** Run `./scripts/docker-setup.sh`, then `docker compose up -d`.

**Want to pick your URL upfront?** Run `npm run docker:setup` instead — it asks for your production hostname and owner email.

---

## First login

1. Open **http://localhost:3000**
2. Click **Register** — the first account becomes the **owner**
3. Go to **Checks → New monitor**, paste a URL, save
4. Wait about a minute — the built-in scheduler runs checks automatically

After the owner exists, nobody else can register on their own. Invite people under **Teams → Members → Invite**; they must register with the invited email.

---

## Going to production

Before exposing the app on the internet, edit `.env`:

```bash
NEXTAUTH_URL=https://monitor.yourcompany.com   # full URL users open in the browser
APP_HOST=monitor.yourcompany.com               # hostname only — used for routing
OWNER_EMAIL=you@yourcompany.com                # optional — locks the first account to you
```

| Variable | Why it matters |
| --- | --- |
| `NEXTAUTH_URL` | Auth.js uses this for cookies and redirects. Wrong value = login fails. |
| `APP_HOST` | Tells the app which host is the dashboard vs a custom status-page domain. |
| `OWNER_EMAIL` | If set before anyone registers, only that email can become owner. |

Then:

1. Put **HTTPS** in front of port **3000** (Caddy, nginx, Traefik, or a cloud load balancer)
2. Run `docker compose up -d`

You do **not** need email, OAuth, or multiple regions for a normal single-server install.

---

## Optional features

| Feature | When you need it | How |
| --- | --- | --- |
| **Status page** | Share uptime publicly | Dashboard → **Status Pages** → create page, mark **public** |
| **Custom domain** | `status.yourcompany.com` instead of `/s/slug` | Status Pages → Custom domains → CNAME to `APP_HOST` → **Check DNS** |
| **Email alerts** | Notifications by email | Add `RESEND_API_KEY` to `.env` → [Configuration](CONFIGURATION.md#email-optional) |
| **Multi-region** | Checks from several countries | [Docker](deploy/docker-multi-region.md) or [K8s](deploy/kubernetes-multi-region.md) |

Custom domains only serve the status page — the dashboard always stays on `APP_HOST`.

---

## FAQ

**Do I need PostgreSQL separately?**  
No. Docker Compose starts it for you.

**Do I need a cron job?**  
No. Checks run inside the app container on a timer (`CRON_SECRET` protects the endpoint if you call it externally).

**Can anyone register?**  
Only until the owner account exists. After that, invite-only.

**Something broke — reset?**  
`docker compose down -v` wipes all data. Run setup again.

**All environment variables?**  
[Configuration reference](CONFIGURATION.md) — most installs never need it.

[← README](../README.md)
