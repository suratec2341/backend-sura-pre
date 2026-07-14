#!/usr/bin/env sh
set -eu

: "${HOSTINGER_HOST:?Set HOSTINGER_HOST, e.g. 10.8.0.10 or your VPS VPN hostname}"
: "${HOSTINGER_USER:?Set HOSTINGER_USER, e.g. root or deploy}"
: "${HOSTINGER_APP_DIR:?Set HOSTINGER_APP_DIR, e.g. /opt/blansole-backend}"

HOSTINGER_PORT="${HOSTINGER_PORT:-22}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-0}"
SSH_KEY_OPT=""

if [ -n "${HOSTINGER_SSH_KEY:-}" ]; then
  SSH_KEY_OPT="-i ${HOSTINGER_SSH_KEY}"
fi

printf '\n==> Deploying to Hostinger through local SSH/VPN bridge\n'
printf 'Host: %s@%s:%s\n' "$HOSTINGER_USER" "$HOSTINGER_HOST" "$HOSTINGER_PORT"
printf 'App dir: %s\n' "$HOSTINGER_APP_DIR"
printf 'Branch: %s\n\n' "$DEPLOY_BRANCH"

ssh ${SSH_KEY_OPT} -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_HOST" \
  "cd '$HOSTINGER_APP_DIR' && DEPLOY_BRANCH='$DEPLOY_BRANCH' RUN_MIGRATIONS='$RUN_MIGRATIONS' sh scripts/deploy-hostinger.sh"
