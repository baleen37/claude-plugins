#!/bin/bash
# Ralph Loop SessionStart Hook
# Stores session_id in CLAUDE_ENV_FILE for use in slash commands
set -euo pipefail

# Source state library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../scripts/lib/state.sh"

# Extract session_id and cwd from environment variables
SESSION_ID="${CLAUDE_SESSION_ID:-}"
CWD="${CLAUDE_CWD:-$(pwd)}"

# Validate session_id exists
if [[ -z "$SESSION_ID" ]] || [[ "$SESSION_ID" == "null" ]]; then
    exit 0
fi

# Validate session_id format
if ! validate_session_id "$SESSION_ID"; then
    exit 0
fi

# Store session_id in ENV_FILE FIRST - before any early exit
# This ensures RALPH_SESSION_ID is always available for /ralph-loop command
# to use when creating a NEW loop (chicken-and-egg problem otherwise)
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

# Quick check: if no Ralph Loop state file exists, exit silently
# Get or create project UUID from current working directory
PROJECT_UUID=$(get_or_create_project_uuid "$CWD")
STATE_DIR="$HOME/.claude/ralph-loop/$PROJECT_UUID"
mkdir -p "$STATE_DIR"
STATE_FILE="$STATE_DIR/ralph-loop-$SESSION_ID.local.md"
if [[ ! -f "$STATE_FILE" ]]; then
    # No active Ralph Loop - exit silently without any output
    # RALPH_SESSION_ID has already been written above for future use
    exit 0
fi

# At this point, STATE_FILE exists, so Ralph Loop is active
# Proceed with showing loop status

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

exit 0
