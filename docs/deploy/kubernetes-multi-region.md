# Kubernetes — multi-region

Run checks from several locations: one **hub** (dashboard + scheduler) and one **worker** release per region. All use the same Helm chart with different values.

Example files: [`charts/ghostwatch/values-examples/`](../../charts/ghostwatch/values-examples/)

Try the layout locally first → [Docker multi-region](docker-multi-region.md)

---

## Hub

The hub owns the database (or points to a shared managed DB) and lists workers in `probeEndpoints`:

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

---

## Each worker

Repeat for every region. Workers connect to the **hub's database** and only run probes:

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

| Rule | Why |
| --- | --- |
| Same `CRON_SECRET` on hub and workers | Workers reject probe requests otherwise |
| `app.probeRegion` matches hub `probeEndpoints` id | Hub must know which worker handles which region |
| Workers use hub `DATABASE_URL` | Check results are stored centrally |
| `probeWorker: true` in worker values | Disables scheduler on workers |

Users only visit the hub URL. Worker URLs are internal probe endpoints.

[← Deploy guides](README.md)
