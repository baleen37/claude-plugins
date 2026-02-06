#!/bin/bash
set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Only process AskUserQuestion
if [[ "$TOOL_NAME" != "AskUserQuestion" ]]; then
    exit 0
fi

# Extract question text
QUESTION_TEXT=$(echo "$INPUT" | jq -r '.questions[0].text // empty')

if [[ -z "$QUESTION_TEXT" ]]; then
    exit 0
fi

# Truncate if too long
MAX_LENGTH=100
if [[ ${#QUESTION_TEXT} -gt $MAX_LENGTH ]]; then
    QUESTION_TEXT="${QUESTION_TEXT:0:$MAX_LENGTH}..."
fi

# Send macOS notification
osascript -e "display notification \"$QUESTION_TEXT\" with title \"Claude Code\" sound name \"Glass\"" 2>/dev/null || true

exit 0
