# Ghostwatch Helm chart

Installs Ghostwatch on Kubernetes: app deployment, optional bundled Postgres, Ingress, and CronJob.

**Install guide:** [docs/deploy/kubernetes-helm.md](../../docs/deploy/kubernetes-helm.md)

**Multi-region:** use [`values-examples/`](values-examples/) with [kubernetes-multi-region.md](../../docs/deploy/kubernetes-multi-region.md) — same chart for hub and workers, different values.

**All options:** [`values.yaml`](values.yaml) — maps to `.env` variables (see [Configuration](../../docs/CONFIGURATION.md#helm-mapping)).
