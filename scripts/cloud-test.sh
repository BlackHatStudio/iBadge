#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"
BASE_URL="${SMOKE_BASE_URL:-http://127.0.0.1:${PORT}}"
WAIT_TIMEOUT_MS="${SMOKE_TIMEOUT_MS:-120000}"
SERVER_PID=""
SERVER_LOG_FILE="${TMPDIR:-/tmp}/ibadge-cloud-dev-server.log"

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

if curl -fsS "$BASE_URL" >/dev/null 2>&1; then
  echo "[cloud-test] Reusing existing server at ${BASE_URL}."
else
  echo "[cloud-test] Starting Next.js dev server on port ${PORT}..."
  npm run dev:cloud >"$SERVER_LOG_FILE" 2>&1 &
  SERVER_PID="$!"

  npx wait-on "$BASE_URL" --timeout "$WAIT_TIMEOUT_MS"
fi

SMOKE_BASE_URL="$BASE_URL" npm run smoke:test
