# Kubernetes — Helm

**Requirements:** Kubernetes cluster, Helm 3

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

Register the owner at your URL.

**Managed DB:** add `--set postgres.enabled=false --set externalDatabase.url="postgresql://..."`

**Multi-region:** [kubernetes-multi-region.md](kubernetes-multi-region.md)

**All options:** [`charts/ghostwatch/values.yaml`](../../charts/ghostwatch/values.yaml)

[← Deploy guides](README.md)
