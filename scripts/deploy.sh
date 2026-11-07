#!/usr/bin/env bash
# Pull the published images, apply the schema, then (re)start the app.
# Works with docker compose and podman compose. Usage: ./scripts/deploy.sh [--no-migrate]
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=${COMPOSE:-"docker compose"}
command -v docker >/dev/null 2>&1 || COMPOSE="podman compose"
FILE="-f docker-compose.prod.yml"

echo "==> pulling images"
$COMPOSE $FILE pull

if [ "${1:-}" != "--no-migrate" ]; then
  echo "==> applying schema"
  # --no-deps: never re-create db, which podman-compose would otherwise do (and collide)
  $COMPOSE $FILE run --rm --no-deps migrate
fi

echo "==> starting"
$COMPOSE $FILE up -d
$COMPOSE $FILE ps
