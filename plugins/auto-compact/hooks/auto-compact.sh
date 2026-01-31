#!/usr/bin/env bash
# Auto Compact Suggester
# Runs on PreToolUse or periodically to suggest manual compaction at logical intervals
#
# Why manual over automatic compaction:
# - Auto-compaction happens at arbitrary points, often mid-task
# - Strategic compacting preserves context through logical phases
# - Compact after exploration, before execution
# - Compact after completing a milestone, before starting next
#
# Criteria for suggesting compact:
# - Session has been running for extended period
# - Large number of tool calls made
# - Transitioning from research/exploration to implementation
# - Plan has been finalized

set -euo pipefail

# Validate session_id format (local copy for now)
validate_session_id() {
  local session_id="$1"
  if [[ ! "$session_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "Warning: Invalid session_id format: '$session_id'" >&2
    return 1
  fi
  return 0
}

# Determine session_id: use environment variable or fall back to PID
SESSION_ID="${AUTO_COMPACT_SESSION_ID:-$$}"
if ! validate_session_id "$SESSION_ID" 2>/dev/null; then
  SESSION_ID="$$"
fi

# Create state directory if it doesn't exist
STATE_DIR="$HOME/.claude/auto-compact"
if [ ! -d "$STATE_DIR" ]; then
  mkdir -p "$STATE_DIR" || {
    echo "Warning: Could not create state directory $STATE_DIR" >&2
    exit 1
  }
fi

# Use session-based persistent file for counter
COUNTER_FILE="$STATE_DIR/tool-count-$SESSION_ID.txt"
THRESHOLD=${COMPACT_THRESHOLD:-50}

# Initialize or increment counter
if [ -f "$COUNTER_FILE" ]; then
  count=$(cat "$COUNTER_FILE")
  count=$((count + 1))
  echo "$count" > "$COUNTER_FILE"
else
  echo "1" > "$COUNTER_FILE"
  count=1
fi

# Suggest compact after threshold tool calls
if [ "$count" -eq "$THRESHOLD" ]; then
  echo "[AutoCompact] $THRESHOLD tool calls reached - consider /compact if transitioning phases" >&2
fi

# Suggest at regular intervals after threshold
if [ "$count" -gt "$THRESHOLD" ] && [ $((count % 25)) -eq 0 ]; then
  echo "[AutoCompact] $count tool calls - good checkpoint for /compact if context is stale" >&2
fi
