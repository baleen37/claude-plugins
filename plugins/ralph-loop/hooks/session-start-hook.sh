#!/bin/bash
# Ralph Loop SessionStart Hook
# Stores session_id in CLAUDE_ENV_FILE for use in slash commands
set -euo pipefail

# Read hook input from stdin
HOOK_INPUT=$(cat)
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id')

# Validate session_id
if [[ -z "$SESSION_ID" ]] || [[ "$SESSION_ID" == "null" ]]; then
    echo "⚠️ Ralph loop: Failed to extract session_id from hook input" >&2
    exit 0
fi

# Store in CLAUDE_ENV_FILE for use in slash commands
echo "export RALPH_SESSION_ID=\"$SESSION_ID\"" >> "$CLAUDE_ENV_FILE"

exit 0
