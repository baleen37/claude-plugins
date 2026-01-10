#!/bin/bash
# Ralph Loop SessionStart Hook
# Stores session_id in CLAUDE_ENV_FILE for use in slash commands
set -euo pipefail

# Extract session_id from stdin (remove useless use of cat)
SESSION_ID=$(jq -r '.session_id')

# Validate session_id exists
if [[ -z "$SESSION_ID" ]] || [[ "$SESSION_ID" == "null" ]]; then
    echo "Warning: Ralph loop failed to extract session_id from hook input" >&2
    exit 0
fi

# Sanitize session_id: only allow alphanumeric, hyphens, underscores
# This prevents code injection via special characters
if [[ ! "$SESSION_ID" =~ ^[a-zA-Z0-9_-]+$ ]]; then
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

exit 0
