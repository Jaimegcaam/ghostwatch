# PostgreSQL backups

GhostWatch stores monitors, results, alerts, users, and status pages in PostgreSQL. **Back up the database before upgrades** and on a regular schedule in production.

---

## Docker Compose (single server)

### Create a backup

```bash
docker compose exec -T postgres pg_dump \
  -U ghostwatch \
  -d ghostwatch \
  --format=custom \
  --file=/tmp/ghostwatch-$(date +%Y%m%d-%H%M%S).dump

docker compose cp postgres:/tmp/ghostwatch-*.dump ./backups/
```

Or in one line from the host:

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U ghostwatch -d ghostwatch --format=custom \
  > "backups/ghostwatch-$(date +%Y%m%d-%H%M%S).dump"
```

### Restore from backup

Stop the app to avoid writes during restore:

```bash
docker compose stop app
```

Restore (replace the filename):

```bash
docker compose exec -T postgres pg_restore \
  -U ghostwatch \
  -d ghostwatch \
  --clean \
  --if-exists \
  < backups/ghostwatch-20260619-120000.dump
```

Start the app again:

```bash
docker compose up -d app
```

---

## Kubernetes / Helm

If you use the bundled Postgres chart values (`postgres.enabled=true`), exec into the pod:

```bash
kubectl exec -n ghostwatch deploy/ghostwatch-postgres -- \
  pg_dump -U ghostwatch -d ghostwatch --format=custom > ghostwatch.dump
```

For managed databases (RDS, Cloud SQL, etc.), use your provider's snapshot or logical backup tooling with the same `DATABASE_URL` credentials.

---

## Recommended schedule

| Environment | Frequency |
| --- | --- |
| Production | Daily automated backups, retain 14–30 days |
| Staging | Weekly |
| Local dev | Before schema migrations only |

Store backups **off the same server** when possible (S3, another VPS, object storage).

---

## Before upgrading GhostWatch

1. Create a fresh backup
2. Pull the new image / chart version
3. Let the container run `prisma migrate deploy` on startup
4. Verify `/api/health?deep=true` and run a test monitor

See also: [Configuration](../CONFIGURATION.md) · [Docker single server](docker-single-server.md)
