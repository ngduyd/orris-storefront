#!/usr/bin/env bash
# Pull the published images, bring up the database, apply the schema, then (re)start the app.
# Works with docker compose and podman compose. Usage: ./scripts/deploy.sh [--no-migrate]
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=${COMPOSE:-"docker compose"}
command -v docker >/dev/null 2>&1 || COMPOSE="podman compose"
FILE="-f docker-compose.prod.yml"
USER_DB=${POSTGRES_USER:-shopify}

echo "==> pulling images"
$COMPOSE $FILE pull

echo "==> starting the database"
$COMPOSE $FILE up -d db >/dev/null

echo -n "==> waiting for postgres"
for _ in $(seq 1 60); do
  if $COMPOSE $FILE exec -T db pg_isready -q -U "$USER_DB" >/dev/null 2>&1; then
    echo " ready"
    break
  fi
  echo -n "."
  sleep 2
done
$COMPOSE $FILE exec -T db pg_isready -q -U "$USER_DB" >/dev/null 2>&1 || {
  echo
  echo "postgres did not become ready; check: $COMPOSE $FILE logs db" >&2
  exit 1
}

if [ "${1:-}" != "--no-migrate" ]; then
  echo "==> applying schema"
  $COMPOSE $FILE run --rm --no-deps migrate
fi

if [ -f data/processed/products.csv ]; then
  echo "==> seeding the catalogue"
  $COMPOSE $FILE run --rm --no-deps migrate npx tsx scripts/seed.ts || {
    echo "seeding failed; the app still starts, rerun: $COMPOSE $FILE run --rm --no-deps migrate npx tsx scripts/seed.ts" >&2
  }
else
  echo "==> no data/processed/products.csv, skipping seed"
fi

echo "==> starting the app"
# explicit services: the one-shot migrate must never be started by `up`
$COMPOSE $FILE up -d db app
$COMPOSE $FILE ps
