#!/bin/bash
# Ralph Loop Status Script
# Shows current Ralph Loop status for the active session
set -euo pipefail

# Source state library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/state.sh"

# Source session env file to get RALPH_SESSION_ID
SESSION_ENV_FILE="$HOME/.claude/ralph-loop/session-env.sh"
if [[ -f "$SESSION_ENV_FILE" ]]; then
    source "$SESSION_ENV_FILE"
fi

# Check if RALPH_SESSION_ID is available
if [[ -z "${RALPH_SESSION_ID:-}" ]]; then
    echo "No active Ralph Loop found"
    echo ""
    echo "To start a Ralph Loop, use /ralph-loop"
    exit 0
fi

# Validate session_id format (security: prevent path traversal)
if ! validate_session_id "$RALPH_SESSION_ID"; then
    echo "Error: RALPH_SESSION_ID contains invalid characters: $RALPH_SESSION_ID" >&2
    exit 1
fi

STATE_DIR="$HOME/.claude/ralph-loop"
STATE_FILE="$STATE_DIR/ralph-loop-$RALPH_SESSION_ID.local.md"

# Check if state file exists
if [[ ! -f "$STATE_FILE" ]]; then
    echo "No active Ralph Loop found for session: $RALPH_SESSION_ID"
    echo ""
    echo "The session env file references a stale session ID."
    echo "This can happen after a loop completes or is cancelled."
    echo "To start a new Ralph Loop, use /ralph-loop"
    exit 0
fi

# Parse frontmatter and extract values
FRONTMATTER=$(parse_frontmatter "$STATE_FILE")
ITERATION=$(get_iteration "$FRONTMATTER")
MAX_ITERATIONS=$(get_max_iterations "$FRONTMATTER")
COMPLETION_PROMISE=$(get_completion_promise "$FRONTMATTER")

# Display status
echo "🔄 Ralph Loop Active"
echo ""
echo "Session ID: $RALPH_SESSION_ID"
echo "Iteration: $ITERATION"

if [[ "$MAX_ITERATIONS" == "0" ]]; then
    echo "Max iterations: unlimited"
else
    echo "Max iterations: $MAX_ITERATIONS"
fi

if [[ "$COMPLETION_PROMISE" != "null" ]] && [[ -n "$COMPLETION_PROMISE" ]]; then
    echo "Completion promise: <promise>$COMPLETION_PROMISE</promise>"
else
    echo "Completion promise: (none - loop runs infinitely)"
fi

echo ""
echo "State file: $STATE_FILE"

# Show the current prompt
PROMPT_TEXT=$(awk '/^---$/{i++; next} i>=2' "$STATE_FILE")
if [[ -n "$PROMPT_TEXT" ]]; then
    echo ""
    echo "Current prompt:"
    echo "$PROMPT_TEXT" | head -3
    prompt_lines=$(echo "$PROMPT_TEXT" | wc -l)
    if [ "$prompt_lines" -gt 3 ]; then
        echo "..."
    fi
fi

exit 0
