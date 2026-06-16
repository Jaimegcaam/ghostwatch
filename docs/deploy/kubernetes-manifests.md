# Kubernetes — raw manifests

For clusters without Helm. **Most K8s users should use [Helm](kubernetes-helm.md) instead.**

```bash
docker build -t your-registry/ghostwatch:latest . && docker push your-registry/ghostwatch:latest
# Edit image: in k8s/40-app.yaml

kubectl apply -f k8s/00-namespace.yaml
kubectl -n ghostwatch create secret generic ghostwatch-secrets \
  --from-literal=AUTH_SECRET=$(openssl rand -base64 32) \
  --from-literal=CRON_SECRET=$(openssl rand -base64 32) \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 24)

kubectl apply -f k8s/10-postgres.yaml -f k8s/30-configmap.yaml \
  -f k8s/40-app.yaml -f k8s/50-cron.yaml -f k8s/60-ingress.yaml
```

Edit `k8s/30-configmap.yaml` — set `NEXTAUTH_URL` and `APP_HOST`.

Do **not** apply `k8s/20-secrets.yaml` (template only).

[`k8s/README.md`](../../k8s/README.md) · [Helm](kubernetes-helm.md)

[← Deploy guides](README.md)
