#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-shito@192.168.1.29}"
REMOTE_DIR="${REMOTE_DIR:-/srv/localserver-homepage}"
SERVICE_NAME="${HOMEPAGE_TAILSCALE_SERVICE_NAME:-svc:homepage}"
SERVICE_HOST="${HOMEPAGE_TAILSCALE_SERVICE_HOST:-homepage.tail81aab6.ts.net}"
TARGET_URL="${HOMEPAGE_TAILSCALE_TARGET_URL:-http://192.168.1.29:3000}"
LAN_BIND_ADDRESS="${HOMEPAGE_LAN_BIND_ADDRESS:-192.168.1.29}"

echo "Configuring ${SERVICE_NAME} on ${REMOTE_HOST}"

# Homepage validates the original HTTPS Host header from Tailscale Serve.
ssh "$REMOTE_HOST" "cd '${REMOTE_DIR}' && if grep -Fq '${SERVICE_HOST}' app.env; then :; elif grep -q '^HOMEPAGE_ALLOWED_HOSTS=' app.env; then sed -i '/^HOMEPAGE_ALLOWED_HOSTS=/ s/$/,${SERVICE_HOST}/' app.env; else printf '%s\\n' 'HOMEPAGE_ALLOWED_HOSTS=${SERVICE_HOST}' >> app.env; fi"
ssh "$REMOTE_HOST" "cd '${REMOTE_DIR}' && if grep -q '^HOMEPAGE_LAN_BIND_ADDRESS=' compose.env; then sed -i 's/^HOMEPAGE_LAN_BIND_ADDRESS=.*/HOMEPAGE_LAN_BIND_ADDRESS=${LAN_BIND_ADDRESS}/' compose.env; else printf '%s\\n' 'HOMEPAGE_LAN_BIND_ADDRESS=${LAN_BIND_ADDRESS}' >> compose.env; fi"
ssh "$REMOTE_HOST" "cd '${REMOTE_DIR}' && docker compose --env-file compose.env -f compose.yml up -d --force-recreate homepage"
ssh "$REMOTE_HOST" "sudo tailscale serve --yes --service='${SERVICE_NAME}' --https=443 --bg '${TARGET_URL}'"
ssh "$REMOTE_HOST" "tailscale serve status --json"

echo "TAILSCALE_HTTPS_CONFIGURED https://${SERVICE_HOST}/"
