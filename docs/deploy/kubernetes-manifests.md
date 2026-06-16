# Kubernetes — YAML

Plain manifests under `k8s/` for clusters without Helm. **Prefer [Helm](kubernetes-helm.md)** if you can — it keeps secrets and values in one place.

## Steps

**1. Build and push the image**

```bash
docker build -t your-registry/ghostwatch:latest .
docker push your-registry/ghostwatch:latest
```

Edit the image reference in `k8s/40-app.yaml`.

**2. Create secrets** (do not commit real values)

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl -n ghostwatch create secret generic ghostwatch-secrets \
  --from-literal=AUTH_SECRET=$(openssl rand -base64 32) \
  --from-literal=CRON_SECRET=$(openssl rand -base64 32) \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 24)
```

**3. Configure the app**

Edit `k8s/30-configmap.yaml`:

- `NEXTAUTH_URL` — public dashboard URL
- `APP_HOST` — dashboard hostname

**4. Apply manifests**

```bash
kubectl apply -f k8s/10-postgres.yaml -f k8s/30-configmap.yaml \
  -f k8s/40-app.yaml -f k8s/50-cron.yaml -f k8s/60-ingress.yaml
```

| File | Purpose |
| --- | --- |
| `10-postgres.yaml` | Database (skip if using managed Postgres) |
| `30-configmap.yaml` | App URLs and feature flags |
| `40-app.yaml` | App deployment |
| `50-cron.yaml` | In-cluster scheduler (alternative to built-in timer) |
| `60-ingress.yaml` | HTTPS ingress |

Do **not** apply `k8s/20-secrets.yaml` in production — it is a template with placeholder values.

[`k8s/README.md`](../../k8s/README.md) · [Helm install](kubernetes-helm.md)

[← Deploy guides](README.md)
