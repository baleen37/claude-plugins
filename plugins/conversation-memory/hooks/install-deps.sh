#!/bin/bash
set -euo pipefail

# Install dependencies on first use of conversation-memory plugin
# This runs when Claude Code session starts

# Check if node_modules exists and is not empty
if [ -d "${CLAUDE_PLUGIN_ROOT}/node_modules" ] && [ -n "$(ls -A "${CLAUDE_PLUGIN_ROOT}/node_modules" 2>/dev/null)" ]; then
  exit 0
fi

# Install production dependencies
cd "${CLAUDE_PLUGIN_ROOT}"
npm install --omit=dev --silent >/dev/null 2>&1

exit 0
