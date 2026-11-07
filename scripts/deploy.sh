#!/usr/bin/env bash
# Pull the published images, bring up the database, apply the schema, then (re)start the app.
# Works with docker compose and podman compose. Usage: ./scripts/deploy.sh [--no-migrate]
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=${COMPOSE:-"docker compose"}
command -v docker >/dev/null 2>&1 || COMPOSE="podman compose"
FILE="-f docker-compose.prod.yml"

echo "==> pulling images"
$COMPOSE $FILE pull

echo "==> starting the database"
$COMPOSE $FILE up -d db

echo -n "==> waiting for postgres"
for _ in $(seq 1 60); do
  if $COMPOSE $FILE exec -T db pg_isready -q -U "${POSTGRES_USER:-shopify}" 2>/dev/null; then
    echo " ready"
    break
  fi
  echo -n "."
  sleep 2
done
$COMPOSE $FILE exec -T db pg_isready -q -U "${POSTGRES_USER:-shopify}" || {
  echo
  echo "postgres did not become ready; check: $COMPOSE $FILE logs db" >&2
  exit 1
}

if [ "${1:-}" != "--no-migrate" ]; then
  echo "==> applying schema"
  # --no-deps: do not re-create db (podman-compose does, and collides)
  $COMPOSE $FILE run --rm --no-deps migrate
fi

echo "==> starting the app"
$COMPOSE $FILE up -d
$COMPOSE $FILE ps
