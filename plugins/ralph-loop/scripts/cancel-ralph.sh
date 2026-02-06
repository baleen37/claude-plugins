#!/bin/bash
# Ralph Loop Cancel Script
# Cancels the active Ralph loop for the current session
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
    echo "Error: RALPH_SESSION_ID environment variable not found" >&2
    echo "" >&2
    echo " This indicates the SessionStart hook may not have run properly." >&2
    echo " Please check that hooks.json is correctly configured." >&2
    exit 1
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
    echo "No active Ralph loop found for current session (session: $RALPH_SESSION_ID)"
    exit 0
fi

# Extract iteration number
FRONTMATTER=$(parse_frontmatter "$STATE_FILE")
ITERATION=$(get_iteration "$FRONTMATTER")

# Remove state file
rm "$STATE_FILE"

# Remove RALPH_SESSION_ID from session-env.sh to prevent stale session IDs
SESSION_ENV_FILE="$HOME/.claude/ralph-loop/session-env.sh"
if [[ -f "$SESSION_ENV_FILE" ]]; then
    # Remove the export line for RALPH_SESSION_ID from the env file
    sed -i.tmp '/^export RALPH_SESSION_ID=/d' "$SESSION_ENV_FILE" 2>/dev/null || true
    rm -f "${SESSION_ENV_FILE}.tmp" 2>/dev/null || true

    # If file is now empty, remove it entirely
    if [[ ! -s "$SESSION_ENV_FILE" ]]; then
        rm -f "$SESSION_ENV_FILE"
    fi
fi

echo "Cancelled Ralph loop for session $RALPH_SESSION_ID (was at iteration $ITERATION)"
