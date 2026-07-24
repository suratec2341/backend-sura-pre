#!/usr/bin/env sh
set -eu

BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-.env}"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-infra}"
PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"
HEALTH_URL="${HEALTH_URL:-}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-30}"
HEALTH_INTERVAL_SECONDS="${HEALTH_INTERVAL_SECONDS:-2}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-0}"
SKIP_GIT_UPDATE="${SKIP_GIT_UPDATE:-0}"
DOCKER_USE_SUDO="${DOCKER_USE_SUDO:-0}"
REQUIRE_EXISTING_DATA_VOLUME="${REQUIRE_EXISTING_DATA_VOLUME:-0}"
DATA_VOLUME="${DATA_VOLUME:-${PROJECT_NAME}_pg_data}"

docker_cli() {
  if [ "$DOCKER_USE_SUDO" = "1" ]; then
    sudo -n docker "$@"
  else
    docker "$@"
  fi
}

compose() {
  docker_cli compose \
    --env-file "$ENV_FILE" \
    -p "$PROJECT_NAME" \
    --parallel "$PARALLEL_LIMIT" \
    -f "$COMPOSE_FILE" \
    "$@"
}

start_services() {
  group="$1"
  shift

  printf '\n==> Starting %s services one at a time\n' "$group"
  for service in "$@"; do
    printf '%s\n' "  -> $service"
    compose up -d --no-deps "$service"
  done
}

wait_for_container() {
  container="$1"
  attempts="$HEALTH_ATTEMPTS"
  status="unknown"
  health="unknown"

  while [ "$attempts" -gt 0 ]; do
    status="$(docker_cli inspect --format '{{.State.Status}}' "$container" 2>/dev/null || true)"
    health="$(docker_cli inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || true)"

    case "$health" in
      healthy)
        printf 'Container ready: %s (health=%s status=%s)\n' \
          "$container" "$health" "$status"
        return 0
        ;;
      starting|unhealthy)
        ;;
      *)
        if [ "$status" = "running" ]; then
          printf 'Container ready: %s (status=%s, no health check)\n' \
            "$container" "$status"
          return 0
        fi
        ;;
    esac

    attempts=$((attempts - 1))
    sleep "$HEALTH_INTERVAL_SECONDS"
  done

  printf 'ERROR: container did not become ready: %s (health=%s status=%s)\n' \
    "$container" "$health" "$status"
  return 1
}

printf '\n==> Blansole Hostinger deploy\n'
printf 'Branch: %s\n' "$BRANCH"
printf 'Compose file: %s\n' "$COMPOSE_FILE"
printf 'Environment file: %s\n' "$ENV_FILE"
printf 'Compose project: %s\n' "$PROJECT_NAME"
printf 'Compose parallel limit: %s\n\n' "$PARALLEL_LIMIT"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Restore the production environment file first."
  exit 1
fi

if grep -q CHANGE_ME "$ENV_FILE"; then
  echo "ERROR: $ENV_FILE still contains CHANGE_ME placeholders."
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

if [ "$DOCKER_USE_SUDO" = "1" ] && ! command -v sudo >/dev/null 2>&1; then
  echo "ERROR: sudo is required when DOCKER_USE_SUDO=1."
  exit 1
fi

if [ "$SKIP_GIT_UPDATE" = "1" ]; then
  printf '==> Using the commit prepared by the CI workflow\n'
else
  printf '==> Pulling latest code\n'
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

printf '\n==> Checking Docker and Compose configuration\n'
docker_cli info >/dev/null
compose config --quiet

if [ "$REQUIRE_EXISTING_DATA_VOLUME" = "1" ]; then
  if ! docker_cli volume inspect "$DATA_VOLUME" >/dev/null 2>&1; then
    echo "ERROR: required data volume not found: $DATA_VOLUME"
    exit 1
  fi
  printf 'Existing data volume found: %s\n' "$DATA_VOLUME"
fi

printf '\n==> Pulling images sequentially\n'
compose pull

start_services "data" postgres redis minio
wait_for_container blansole-postgres
wait_for_container blansole-redis
wait_for_container blansole-minio

if [ "$RUN_MIGRATIONS" = "1" ]; then
  printf '\n==> Running Prisma migrations\n'
  compose run --rm --no-deps api npx prisma migrate deploy
else
  printf '\n==> Skipping migrations. Set RUN_MIGRATIONS=1 to run prisma migrate deploy.\n'
fi

start_services "application" \
  api \
  worker-session \
  worker-ai \
  worker-notification \
  worker-health-sync \
  worker-link-checker \
  worker-episode-summary \
  nginx

start_services "observability" \
  loki \
  prometheus \
  promtail \
  grafana \
  cadvisor

if [ -z "$HEALTH_URL" ]; then
  NGINX_HTTP_PORT="$(
    sed -n 's/^NGINX_HTTP_PORT=//p' "$ENV_FILE" \
      | tail -n 1 \
      | tr -d '\r'
  )"
  NGINX_HTTP_PORT="${NGINX_HTTP_PORT:-8081}"
  HEALTH_URL="http://127.0.0.1:${NGINX_HTTP_PORT}/healthz"
fi

printf '\n==> Waiting for health endpoint: %s\n' "$HEALTH_URL"
attempts="$HEALTH_ATTEMPTS"
while [ "$attempts" -gt 0 ]; do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    printf 'Health check passed: %s\n' "$HEALTH_URL"
    break
  fi

  attempts=$((attempts - 1))
  sleep "$HEALTH_INTERVAL_SECONDS"
done

if [ "$attempts" -eq 0 ]; then
  echo "ERROR: health check failed. Showing recent logs:"
  compose ps
  compose logs --tail=120 api nginx
  exit 1
fi

printf '\n==> Deployment status\n'
compose ps
printf '\nDeploy completed successfully.\n'
