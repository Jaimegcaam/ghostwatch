# Getting started

Install Ghostwatch and create your first monitor in a few minutes.

**You need:** [Docker](https://docs.docker.com/get-docker/) (Docker Desktop on Mac/Windows is fine).

---

## Install (choose one)

### A — One command

From the repo folder (needs [Node.js](https://nodejs.org) installed):

```bash
npm run docker:init
```

This creates `.env`, starts the stack, and prints the URL.

### B — Docker only (no Node)

```bash
chmod +x scripts/docker-setup.sh   # first time only
./scripts/docker-setup.sh
docker compose up -d
```

### C — Interactive setup

```bash
npm run docker:setup    # asks for URL and owner email
docker compose up -d
```

---

## First login

1. Open **http://localhost:3000**
2. **Register** — the first account becomes the **owner**
3. Go to **Checks → New monitor** — paste a URL, save
4. Wait ~1 minute — you should see the first result

Nobody else can sign up on their own. Invite teammates under **Teams → Members → Invite**.

---

## Going to production

Before exposing the app on the internet:

1. Run setup again (delete `.env` first) or edit `.env`:

   ```bash
   NEXTAUTH_URL=https://monitor.yourcompany.com
   APP_HOST=monitor.yourcompany.com
   OWNER_EMAIL=you@yourcompany.com
   ```

2. Put **HTTPS** in front of port 3000 (Caddy, nginx, Traefik, or your cloud load balancer).

3. `docker compose up -d`

You do **not** need email, OAuth, or multiple regions for a normal install.

---

## Optional features

| Feature | Do you need it? | How |
| --- | --- | --- |
| Email invites & alerts | Only if you want mail | Add `RESEND_API_KEY` to `.env` → [Configuration](CONFIGURATION.md#email-optional) |
| Public status page | Share uptime with customers | Dashboard → **Status Pages** |
| Custom domain | `status.yourcompany.com` | Status Pages → Custom domains → CNAME → **Check DNS** |
| Checks from multiple countries | Advanced | [Docker multi-region](deploy/docker-multi-region.md) or [Kubernetes multi-region](deploy/kubernetes-multi-region.md) |

---

## Other setups

| I want to… | Guide |
| --- | --- |
| Hack on the source code | [Local development](deploy/local-development.md) |
| Run on Kubernetes | [Helm install](deploy/kubernetes-helm.md) |
| Kubernetes without Helm | [Raw YAML](deploy/kubernetes-manifests.md) |

---

## FAQ

**Do I need PostgreSQL separately?**  
No. Docker Compose starts Postgres for you.

**Do I need to run a cron job?**  
No. Checks run automatically inside the app container.

**Can anyone register?**  
Only until the owner account exists. After that, invite-only.

**Something broke — how do I reset?**  
`docker compose down -v` deletes all data. Then run setup again.

**Where are all the settings?**  
[Configuration reference](CONFIGURATION.md) — most people never need it.

[← Main README](../README.md)
