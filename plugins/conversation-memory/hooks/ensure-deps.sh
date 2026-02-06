#!/usr/bin/env bash
# Ensure dependencies are installed for conversation-memory plugin
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"

if [ ! -d "${PLUGIN_ROOT}/node_modules" ]; then
  echo "[conversation-memory] Installing dependencies..." >&2
  cd "${PLUGIN_ROOT}"
  bun install --silent
  echo "[conversation-memory] Dependencies installed." >&2
fi
