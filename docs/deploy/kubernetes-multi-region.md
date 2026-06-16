# Kubernetes — multi-region

**Advanced.** Same Helm chart for hub and each worker.

Example values: [`charts/ghostwatch/values-examples/`](../../charts/ghostwatch/values-examples/)

## Hub

```bash
helm install ghostwatch-hub ./charts/ghostwatch \
  -n ghostwatch --create-namespace \
  -f charts/ghostwatch/values-examples/hub-multiregion.yaml \
  --set postgres.password="$PG_PASSWORD" \
  --set secrets.authSecret="$AUTH_SECRET" \
  --set secrets.cronSecret="$CRON_SECRET" \
  --set app.nextauthUrl=https://monitor.example.com \
  --set app.host=monitor.example.com \
  --set app.probeEndpoints="us-east-1|https://probe-va.example.com|North Virginia,eu-south-2|https://probe-es.example.com|Spain"
```

## Each worker (repeat per region)

```bash
helm install ghostwatch-worker-es ./charts/ghostwatch \
  -n ghostwatch-workers --create-namespace \
  -f charts/ghostwatch/values-examples/worker.yaml \
  --set app.probeRegion=eu-south-2 \
  --set app.nextauthUrl=https://probe-es.example.com \
  --set app.host=probe-es.example.com \
  --set externalDatabase.url="postgresql://...@HUB-DB:5432/ghostwatch?schema=public" \
  --set secrets.authSecret="$AUTH_SECRET" \
  --set secrets.cronSecret="$CRON_SECRET"
```

| Rule | |
| --- | --- |
| Same chart | `./charts/ghostwatch` for hub **and** every worker |
| `CRON_SECRET` | Must match the hub |
| `app.probeRegion` | Must match an id in hub `probeEndpoints` |

Try locally first → [Docker multi-region](docker-multi-region.md)

[← Deploy guides](README.md)
