#!/usr/bin/env sh
set -eu

BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.yml}"
HEALTH_URL="${HEALTH_URL:-http://localhost:${NGINX_HTTP_PORT:-8081}/healthz}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-0}"

printf '\n==> Blansole Hostinger deploy\n'
printf 'Branch: %s\n' "$BRANCH"
printf 'Compose file: %s\n' "$COMPOSE_FILE"
printf 'Health URL: %s\n\n' "$HEALTH_URL"

if [ ! -f ".env" ]; then
  echo "ERROR: .env not found. Create it from .env.hostinger.example and fill secrets first."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git is not installed."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed."
  exit 1
fi

printf '==> Pulling latest code\n'
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

printf '\n==> Building and starting Docker services\n'
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

if [ "$RUN_MIGRATIONS" = "1" ]; then
  printf '\n==> Running Prisma migrations inside api container\n'
  docker compose -f "$COMPOSE_FILE" exec -T api npx prisma migrate deploy
else
  printf '\n==> Skipping migrations. Set RUN_MIGRATIONS=1 to run prisma migrate deploy.\n'
fi

printf '\n==> Waiting for health endpoint\n'
ATTEMPTS=30
while [ "$ATTEMPTS" -gt 0 ]; do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    printf 'Health check passed: %s\n' "$HEALTH_URL"
    break
  fi

  ATTEMPTS=$((ATTEMPTS - 1))
  sleep 2
done

if [ "$ATTEMPTS" -eq 0 ]; then
  echo "ERROR: health check failed. Showing recent logs:"
  docker compose -f "$COMPOSE_FILE" ps
  docker compose -f "$COMPOSE_FILE" logs --tail=120 api nginx
  exit 1
fi

printf '\n==> Deployment status\n'
docker compose -f "$COMPOSE_FILE" ps
printf '\nDeploy completed successfully.\n'
