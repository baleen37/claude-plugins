#!/usr/bin/env bash
# Memory Persistence Stop Hook
# Captures and saves session state when Claude session ends
# This hook does NOT block session exit - it exits silently

set -euo pipefail

# Source state library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../scripts/lib/state.sh"

# Read hook input from stdin (Stop hook API)
HOOK_INPUT=$(</dev/stdin)

# Extract session_id from hook input
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id')

# Validate session_id exists
if [[ -z "$SESSION_ID" ]] || [[ "$SESSION_ID" == "null" ]]; then
    # Only write to stderr on WARNING/ERROR conditions
    echo "Warning: Memory persistence: No session_id found in Stop hook" >&2
    exit 0  # Always exit 0 to avoid blocking session exit
fi

# Validate session_id format
if ! validate_session_id "$SESSION_ID"; then
    # Only write to stderr on WARNING/ERROR conditions
    echo "Warning: Memory persistence: Invalid session_id format: '$SESSION_ID'" >&2
    exit 0  # Always exit 0 to avoid blocking session exit
fi

# Get transcript path from hook input
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path')

if [[ ! -f "$TRANSCRIPT_PATH" ]]; then
    # Only write to stderr on WARNING/ERROR conditions
    echo "Warning: Memory persistence: Transcript file not found: $TRANSCRIPT_PATH" >&2
    exit 0  # Always exit 0 to avoid blocking session exit
fi

# Extract last assistant message from transcript
CONVERSATION=$(extract_assistant_message_from_transcript "$TRANSCRIPT_PATH")

if [[ -z "$CONVERSATION" ]]; then
    # Only write to stderr on WARNING/ERROR conditions
    echo "Warning: Memory persistence: No conversation content extracted" >&2
    exit 0  # Always exit 0 to avoid blocking session exit
fi

# Build session content
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
SESSION_CONTENT="# Session: $SESSION_ID
# Date: $TIMESTAMP

## Last Assistant Message

$CONVERSATION

## Session Metadata

- Session ID: $SESSION_ID
- End Time: $TIMESTAMP
- Transcript: $TRANSCRIPT_PATH
- Saved by: memory-persistence plugin
"

# Save session file
SESSION_FILE=$(save_session_file "$SESSION_ID" "$SESSION_CONTENT")

if [[ -z "$SESSION_FILE" ]]; then
    # Only write to stderr on ERROR conditions
    echo "Warning: Memory persistence: Failed to save session" >&2
fi

# CRITICAL: Exit 0 WITHOUT any output on success
# - No stdout (that would block session exit like ralph-loop does)
# - No stderr on success (following ralph-loop's TRUE silent pattern)
# - Stderr is only for WARNING/ERROR conditions above
exit 0
