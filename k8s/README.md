# Kubernetes manifests

Plain YAML (no Helm). **Prefer [Helm](../docs/deploy/kubernetes-helm.md) if you can.**

**Start here:** [docs/deploy/kubernetes-manifests.md](../docs/deploy/kubernetes-manifests.md)

| File | Purpose |
| --- | --- |
| `30-configmap.yaml` | URLs and flags — edit this |
| `40-app.yaml` | App deployment |
| `10-postgres.yaml` | Database (or use managed DB) |
| `60-ingress.yaml` | HTTPS ingress |

Do not apply `20-secrets.yaml` in production.
