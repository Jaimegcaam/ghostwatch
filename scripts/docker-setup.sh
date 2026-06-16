#!/usr/bin/env bash
# Creates .env for Docker Compose (no Node required).
# Usage: ./scripts/docker-setup.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV="$ROOT/.env"
TEMPLATE="$ROOT/.env.docker.example"

if [[ -f "$ENV" ]]; then
  echo ""
  echo ".env already exists — nothing changed."
  echo "Delete it first if you want a fresh setup."
  echo ""
  exit 0
fi

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Missing .env.docker.example — run from the repo root." >&2
  exit 1
fi

gen() {
  openssl rand -base64 "$1" | tr -d '\n'
}

AUTH_SECRET="$(gen 32)"
CRON_SECRET="$(gen 32)"
PG_PASSWORD="$(gen 24)"

cp "$TEMPLATE" "$ENV"

replace() {
  local key="$1"
  local value="$2"
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV"
  else
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV"
  fi
}

replace AUTH_SECRET "$AUTH_SECRET"
replace CRON_SECRET "$CRON_SECRET"
replace POSTGRES_PASSWORD "$PG_PASSWORD"

echo ""
echo "✓ Created .env with generated secrets."
echo ""
echo "Next:"
echo "  docker compose up -d"
echo "  open http://localhost:3000"
echo ""
echo "Tip: edit .env to set NEXTAUTH_URL before going to production."
echo ""
