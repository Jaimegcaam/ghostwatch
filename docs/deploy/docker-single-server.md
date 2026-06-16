# Docker — single server

> **First time?** Follow [Getting started](../GETTING-STARTED.md) instead — same steps, more context.

```bash
npm run docker:init
# or: ./scripts/docker-setup.sh && docker compose up -d
```

## Production URL

Edit `.env` **before** `docker compose up -d`:

```bash
NEXTAUTH_URL=https://monitor.yourcompany.com
APP_HOST=monitor.yourcompany.com
```

Add HTTPS in front of port **3000**.

## Updates & stop

```bash
git pull && docker compose build app && docker compose up -d
docker compose down        # keep data
docker compose down -v     # wipe everything
```

[Getting started](../GETTING-STARTED.md) · [Multi-region](docker-multi-region.md)
