#!/bin/bash
# Auto Compact SessionStart Hook
# Extracts session_id from SessionStart hook and stores it in CLAUDE_ENV_FILE
set -euo pipefail

# Source state library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/state.sh"

# Extract session_id from stdin (SessionStart hook JSON)
SESSION_ID=$(jq -r '.session_id')

# Validate session_id exists
if [[ -z "$SESSION_ID" ]] || [[ "$SESSION_ID" == "null" ]]; then
    exit 0
fi

# Validate session_id format
if ! validate_session_id "$SESSION_ID"; then
    exit 0
fi

# Store session_id in ENV_FILE for use by auto-compact.sh
ENV_FILE="${CLAUDE_ENV_FILE:-}"
if [[ -z "$ENV_FILE" ]]; then
    # Create state directory if it doesn't exist
    mkdir -p ~/.claude/auto-compact
    ENV_FILE="$HOME/.claude/auto-compact/session-env.sh"
fi

# Create ENV_FILE if it doesn't exist
if [[ ! -f "$ENV_FILE" ]]; then
    touch "$ENV_FILE" || exit 0
fi

if [[ -w "$ENV_FILE" ]]; then
    # Safe to use unquoted since we validated SESSION_ID contains only safe characters
    echo "export AUTO_COMPACT_SESSION_ID=$SESSION_ID" >> "$ENV_FILE"
fi

exit 0
