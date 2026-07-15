#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cp "$ROOT_DIR/compose.yml" "$TMP_DIR/compose.yml"
cp "$ROOT_DIR/compose.env.example" "$TMP_DIR/compose.env"
cp "$ROOT_DIR/app.env.example" "$TMP_DIR/app.env"
cp -R "$ROOT_DIR/config" "$TMP_DIR/config"
cp -R "$ROOT_DIR/balance-api" "$TMP_DIR/balance-api"
cp -R "$ROOT_DIR/openai-cost-api" "$TMP_DIR/openai-cost-api"
cp -R "$ROOT_DIR/gpu-api" "$TMP_DIR/gpu-api"
cp -R "$ROOT_DIR/xtcg-runtime-api" "$TMP_DIR/xtcg-runtime-api"

docker compose --env-file "$TMP_DIR/compose.env" -f "$TMP_DIR/compose.yml" config --quiet
node --test "$ROOT_DIR/openai-cost-api/server.test.js"

echo "VERIFY_PASS homepage_compose_config"
echo "VERIFY_PASS openai_cost_api_tests"
