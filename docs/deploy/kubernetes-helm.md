# Kubernetes — Helm

Deploy Ghostwatch on Kubernetes using the chart in `charts/ghostwatch/`.

**You need:** a Kubernetes cluster and Helm 3.

## Install

Generate secrets once, then install:

```bash
AUTH_SECRET=$(openssl rand -base64 32)
CRON_SECRET=$(openssl rand -base64 32)
PG_PASSWORD=$(openssl rand -base64 24)

helm install ghostwatch ./charts/ghostwatch \
  --namespace ghostwatch --create-namespace \
  --set app.nextauthUrl=https://monitor.example.com \
  --set app.host=monitor.example.com \
  --set secrets.authSecret="$AUTH_SECRET" \
  --set secrets.cronSecret="$CRON_SECRET" \
  --set postgres.password="$PG_PASSWORD" \
  --set ingress.enabled=true
```

| `--set` | Purpose |
| --- | --- |
| `app.nextauthUrl` | Public dashboard URL (login cookies) |
| `app.host` | Dashboard hostname (routing vs status domains) |
| `secrets.authSecret` | Session signing |
| `secrets.cronSecret` | Scheduler / probe authentication |
| `postgres.password` | Bundled Postgres password (if `postgres.enabled=true`) |
| `ingress.enabled` | Creates an Ingress for HTTPS (configure your controller) |

Open your URL and register — first user is owner.

---

## Managed database

To use RDS, Cloud SQL, etc. instead of the bundled Postgres:

```bash
--set postgres.enabled=false \
--set externalDatabase.url="postgresql://user:pass@host:5432/ghostwatch?schema=public"
```

---

## Multi-region

Hub + workers use the same chart with different values. See [kubernetes-multi-region.md](kubernetes-multi-region.md) and [`values-examples/`](../../charts/ghostwatch/values-examples/).

**All chart options:** [`values.yaml`](../../charts/ghostwatch/values.yaml)

[← Deploy guides](README.md)
