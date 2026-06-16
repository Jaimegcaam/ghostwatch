# Local development

Run Ghostwatch from source with hot reload. Use this when changing UI or backend code — not for a production install ([Getting started](../GETTING-STARTED.md) with Docker is easier for that).

**Requirements:** Node 20+, Docker (for Postgres)

```bash
npm install
npm run setup              # creates .env from .env.example
npm run db:up              # starts Postgres in Docker
npm run db:migrate         # applies schema
npm run dev                # terminal 1 — Next.js on :3000
npm run cron               # terminal 2 — runs scheduled checks
```

Open http://localhost:3000 and register.

**Why two terminals?** In dev, the check scheduler runs as a separate process (`npm run cron`). In Docker production, both run inside the same container.

Key `.env` values for local dev:

| Variable | Typical value |
| --- | --- |
| `DATABASE_URL` | Set by `npm run setup` |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `APP_HOST` | `localhost:3000` |

[← Deploy guides](README.md)
