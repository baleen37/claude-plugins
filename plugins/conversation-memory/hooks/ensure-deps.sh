#!/usr/bin/env bash
# Ensure dependencies are installed for conversation-memory plugin
# Runs silently in background - no output, no blocking
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"

if [ ! -d "${PLUGIN_ROOT}/node_modules" ]; then
  cd "${PLUGIN_ROOT}"
  # Silent install in background, detached
  npm install --silent --no-audit --no-fund >/dev/null 2>&1 &
fi

exit 0
