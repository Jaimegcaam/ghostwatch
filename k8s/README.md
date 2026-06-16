# Kubernetes manifests

Plain YAML alternative to Helm. **Prefer [Helm](../docs/deploy/kubernetes-helm.md)** for easier upgrades and secret management.

**Install guide:** [docs/deploy/kubernetes-manifests.md](../docs/deploy/kubernetes-manifests.md)

| File | Edit for |
| --- | --- |
| `30-configmap.yaml` | `NEXTAUTH_URL`, `APP_HOST`, region settings |
| `40-app.yaml` | Container image reference |
| `60-ingress.yaml` | Your domain and TLS |

Do not apply `20-secrets.yaml` in production — create secrets with `kubectl create secret` instead.
