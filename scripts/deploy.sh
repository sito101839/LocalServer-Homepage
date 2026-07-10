#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REMOTE_HOST="${REMOTE_HOST:-shito@192.168.1.29}"
REMOTE_DIR="${REMOTE_DIR:-/srv/localserver-homepage}"
REMOTE_URL="${REMOTE_URL:-http://192.168.1.29:3000/}"
GLANCES_URL="${GLANCES_URL:-http://192.168.1.29:61208/}"

echo "Deploy target: ${REMOTE_HOST}:${REMOTE_DIR}"

wait_for_url() {
  local url="$1"
  ssh "$REMOTE_HOST" "for _ in 1 2 3 4 5 6 7 8 9 10; do curl --fail --silent --show-error --max-time 10 '${url}' >/dev/null && exit 0; sleep 1; done; curl --fail --silent --show-error --max-time 10 '${url}' >/dev/null"
}

ssh "$REMOTE_HOST" "if [ ! -d '${REMOTE_DIR}' ]; then sudo mkdir -p '${REMOTE_DIR}' && sudo chown shito:shito '${REMOTE_DIR}'; fi"
ssh "$REMOTE_HOST" "mkdir -p '${REMOTE_DIR}/config' '${REMOTE_DIR}/backups'"

ssh "$REMOTE_HOST" "if [ -d '${REMOTE_DIR}/config' ]; then tar -czf '${REMOTE_DIR}/backups/config-\$(date +%Y%m%d-%H%M%S).tgz' -C '${REMOTE_DIR}' config compose.yml compose.env app.env 2>/dev/null || true; fi"

rsync -az "$ROOT_DIR/compose.yml" "$ROOT_DIR/compose.env.example" "$ROOT_DIR/app.env.example" "$REMOTE_HOST:${REMOTE_DIR}/"
rsync -az "$ROOT_DIR/config/" "$REMOTE_HOST:${REMOTE_DIR}/config/"

ssh "$REMOTE_HOST" "cd '${REMOTE_DIR}' && [ -f compose.env ] || cp compose.env.example compose.env"
ssh "$REMOTE_HOST" "cd '${REMOTE_DIR}' && [ -f app.env ] || cp app.env.example app.env"

ssh "$REMOTE_HOST" "cd '${REMOTE_DIR}' && docker compose --env-file compose.env -f compose.yml pull"
ssh "$REMOTE_HOST" "cd '${REMOTE_DIR}' && docker compose --env-file compose.env -f compose.yml up -d"
ssh "$REMOTE_HOST" "cd '${REMOTE_DIR}' && docker compose --env-file compose.env -f compose.yml ps"
wait_for_url "$REMOTE_URL"
wait_for_url "$GLANCES_URL"

echo "DEPLOY_PASS ${REMOTE_URL}"
