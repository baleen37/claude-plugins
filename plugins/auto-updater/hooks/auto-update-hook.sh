#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${HOME}/.claude/auto-updater"
TIMESTAMP_FILE="${CONFIG_DIR}/last-check"
CHECK_INTERVAL=3600  # 1 hour in seconds

# Create config dir if needed
mkdir -p "$CONFIG_DIR"

# Check if we need to run
SHOULD_RUN=false

if [ ! -f "$TIMESTAMP_FILE" ]; then
  SHOULD_RUN=true
else
  LAST_CHECK=$(cat "$TIMESTAMP_FILE" 2>/dev/null || echo "0")
  CURRENT_TIME=$(date +%s)
  TIME_DIFF=$((CURRENT_TIME - LAST_CHECK))

  if [ "$TIME_DIFF" -ge "$CHECK_INTERVAL" ]; then
    SHOULD_RUN=true
  fi
fi

if [ "$SHOULD_RUN" = true ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  "${SCRIPT_DIR}/../scripts/update.sh" >/dev/null 2>&1 || true
fi

exit 0
