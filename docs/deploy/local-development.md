# Local development

**Requirements:** Node 20+

```bash
npm install
npm run setup
npm run db:up && npm run db:migrate
npm run dev            # terminal 1
npm run cron           # terminal 2 — required for scheduled checks
```

Open http://localhost:3000 and register.

**Just want to run the product?** Use [Getting started](../GETTING-STARTED.md) (Docker) instead.

[← Deploy guides](README.md)
