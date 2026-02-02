#!/usr/bin/env bash
# Memory Persistence SessionStart Hook
# Restores relevant context from recent sessions

set -euo pipefail

# Source state library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../scripts/lib/state.sh"

# Read hook input from stdin and extract session_id and transcript_path
HOOK_INPUT=$(</dev/stdin)
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id')
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path')

# Validate session_id exists
if [[ -z "$SESSION_ID" ]] || [[ "$SESSION_ID" == "null" ]]; then
    exit 0
fi

# Validate session_id format
if ! validate_session_id "$SESSION_ID"; then
    exit 0
fi

# Find recent session files for this project
RECENT_SESSIONS=$(find_recent_sessions 5 "$TRANSCRIPT_PATH")

if [[ -z "$RECENT_SESSIONS" ]]; then
    # No previous sessions found
    exit 0
fi

# Display restored context header
# NOTE: SessionStart hook CAN write to stdout (unlike Stop hook)
# because SessionStart output is expected and shown to the user.
# Stop hook must be silent on success to avoid blocking session exit.
echo ""
echo "## Restored Context from Previous Sessions"
echo ""

# Process each recent session
while IFS= read -r session_file; do
    if [[ -f "$session_file" ]]; then
        echo "### From: $(basename "$session_file")"
        echo ""
        # Extract and display summary (first 50 lines)
        head -n 50 "$session_file"
        echo ""
        echo "---"
        echo ""
    fi
done <<< "$RECENT_SESSIONS"

exit 0
