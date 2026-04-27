#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[cloud-setup] Installing root dependencies..."
npm install --prefix "$ROOT_DIR"

echo "[cloud-setup] Installing server dependencies..."
npm install --prefix "$ROOT_DIR/server"

echo "[cloud-setup] Installing Playwright Chromium runtime..."
npx --prefix "$ROOT_DIR" playwright install --with-deps chromium

echo "[cloud-setup] Setup complete."
