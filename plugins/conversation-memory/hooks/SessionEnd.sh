#!/usr/bin/env bash
set -euo pipefail

# Auto-sync conversations to conversation-memory database
# Runs in background to avoid blocking session end

# Start sync in background, redirect output to system logger
nohup node "${CLAUDE_PLUGIN_ROOT}/dist/cli.mjs" sync \
  > /dev/null 2>&1 &

# Return success immediately (don't wait for background process)
exit 0
