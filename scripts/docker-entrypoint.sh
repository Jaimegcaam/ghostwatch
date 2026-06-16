#!/bin/sh
# Ghostwatch container entrypoint.
# 1. Prisma migrations
# 2. Start Next.js server
# 3. Wait until healthy, then start check scheduler
# 4. Wait on the server process (PID 1 via tini)

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL is not set" >&2
  exit 1
fi

echo "[entrypoint] Running prisma migrate deploy..."
PRISMA_CLI="/opt/migrate/node_modules/prisma/build/index.js"
if [ ! -f "$PRISMA_CLI" ]; then
  echo "[entrypoint] Prisma CLI missing. Rebuild: docker compose build --no-cache" >&2
  exit 1
fi
(
  cd /opt/migrate
  node ./node_modules/prisma/build/index.js migrate deploy
) || {
  echo "[entrypoint] Migration failed. Aborting."
  exit 1
}

echo "[entrypoint] Starting Next.js server..."
node server.js &
SERVER_PID=$!

HEALTH_URL="http://127.0.0.1:3000/api/health"
echo "[entrypoint] Waiting for app to be ready..."
ready=0
for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done

if [ "$ready" != "1" ]; then
  echo "[entrypoint] App did not become healthy in time" >&2
  kill "$SERVER_PID" 2>/dev/null || true
  exit 1
fi

if [ "${ENABLE_BUILTIN_SCHEDULER:-true}" = "true" ] && [ -n "$CRON_SECRET" ]; then
  echo "[entrypoint] Starting check scheduler..."
  export CRON_BASE_URL="${CRON_BASE_URL:-http://127.0.0.1:3000}"
  node scripts/local-cron.mjs &
fi

echo "[entrypoint] Ghostwatch is ready."
wait "$SERVER_PID"
