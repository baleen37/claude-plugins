#!/bin/bash
# Ralph Loop SessionStart Hook
# Stores session_id in CLAUDE_ENV_FILE for use in slash commands
set -euo pipefail

# Source state library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../scripts/lib/state.sh"

# Extract session_id from stdin
SESSION_ID=$(jq -r '.session_id' </dev/stdin)

# Validate session_id exists
if [[ -z "$SESSION_ID" ]] || [[ "$SESSION_ID" == "null" ]]; then
    exit 0
fi

# Validate session_id format
if ! validate_session_id "$SESSION_ID"; then
    exit 0
fi

# Quick check: if no Ralph Loop state file exists, exit silently
STATE_DIR="$HOME/.claude/ralph-loop"
STATE_FILE="$STATE_DIR/ralph-loop-$SESSION_ID.local.md"
if [[ ! -f "$STATE_FILE" ]]; then
    # No active Ralph Loop - exit silently without any output or side effects
    exit 0
fi

# At this point, STATE_FILE exists, so Ralph Loop is active
# Proceed with normal initialization

# Parse the state file to get loop information
FRONTMATTER=$(parse_frontmatter "$STATE_FILE")
ITERATION=$(get_iteration "$FRONTMATTER")
MAX_ITERATIONS=$(get_max_iterations "$FRONTMATTER")
COMPLETION_PROMISE=$(get_completion_promise "$FRONTMATTER")

# Build status message to show Claude
echo "🔄 Ralph Loop Active (iteration $ITERATION)"
if [[ "$MAX_ITERATIONS" != "0" ]]; then
    echo "   Max iterations: $MAX_ITERATIONS"
else
    echo "   Max iterations: unlimited"
fi
if [[ "$COMPLETION_PROMISE" != "null" ]] && [[ -n "$COMPLETION_PROMISE" ]]; then
    echo "   Completion promise: <promise>$COMPLETION_PROMISE</promise>"
fi
echo "   State file: $STATE_FILE"
echo ""

# Store session_id in ENV_FILE for use in slash commands (optional, for /cancel-ralph)
ENV_FILE="${CLAUDE_ENV_FILE:-}"
if [[ -z "$ENV_FILE" ]]; then
    mkdir -p ~/.claude/ralph-loop
    ENV_FILE="$HOME/.claude/ralph-loop/session-env.sh"
fi

# Write SESSION_ID to ENV_FILE
# If file exists and is writable, append to it
# Otherwise (including just-created file), write to it directly
if [[ -f "$ENV_FILE" ]] && [[ -w "$ENV_FILE" ]]; then
    # Safe to use unquoted since we validated SESSION_ID contains only safe characters
    echo "export RALPH_SESSION_ID=$SESSION_ID" >> "$ENV_FILE"
elif [[ ! -f "$ENV_FILE" ]]; then
    # File doesn't exist (just created above), create it with content
    # Safe to use unquoted since we validated SESSION_ID contains only safe characters
    echo "export RALPH_SESSION_ID=$SESSION_ID" > "$ENV_FILE"
fi

exit 0
