#!/bin/bash
# Ralph Loop SessionStart Hook
# Stores session_id in CLAUDE_ENV_FILE for use in slash commands
set -euo pipefail

# Source state library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../scripts/lib/state.sh"

# Extract session_id from stdin (remove useless use of cat)
SESSION_ID=$(jq -r '.session_id')

# Validate session_id exists
if [[ -z "$SESSION_ID" ]] || [[ "$SESSION_ID" == "null" ]]; then
    echo "Warning: Ralph loop failed to extract session_id from hook input" >&2
    exit 0
fi

# Validate session_id format
if ! validate_session_id "$SESSION_ID"; then
    echo "Warning: Ralph loop session_id contains invalid characters: $SESSION_ID" >&2
    exit 0
fi

# Fallback to /tmp if CLAUDE_ENV_FILE is not set
ENV_FILE="${CLAUDE_ENV_FILE:-}"
if [[ -z "$ENV_FILE" ]]; then
    # Use /tmp as fallback when CLAUDE_ENV_FILE is not set
    mkdir -p ~/.claude/ralph-loop
    ENV_FILE="$HOME/.claude/ralph-loop/session-env.sh"
fi

# Validate ENV_FILE exists and is writable
if [[ ! -f "$ENV_FILE" ]]; then
    touch "$ENV_FILE" 2>/dev/null || {
        echo "Warning: Cannot create ENV_FILE: $ENV_FILE" >&2
        exit 0
    }
fi

if [[ ! -w "$ENV_FILE" ]]; then
    echo "Warning: ENV_FILE is not writable: $ENV_FILE" >&2
    exit 0
fi

# Store in ENV_FILE for use in slash commands
# Safe to use unquoted since we validated SESSION_ID contains only safe characters
echo "export RALPH_SESSION_ID=$SESSION_ID" >> "$ENV_FILE"

# Check if there's an existing active Ralph Loop for this session
STATE_DIR="$HOME/.claude/ralph-loop"
STATE_FILE="$STATE_DIR/ralph-loop-$SESSION_ID.local.md"

if [[ -f "$STATE_FILE" ]]; then
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
fi

exit 0
