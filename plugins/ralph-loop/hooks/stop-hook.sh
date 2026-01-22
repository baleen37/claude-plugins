#!/bin/bash
# Ralph Loop Stop Hook
# Prevents session exit when a ralph-loop is active
# Feeds Claude's output back as input to continue the loop
set -euo pipefail

# Source state library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../scripts/lib/state.sh"

# Read hook input from stdin (advanced stop hook API)
HOOK_INPUT=$(</dev/stdin)

# Extract session_id from hook input
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id')

# Validate session_id format
if ! validate_session_id "$SESSION_ID"; then
    echo "Warning: Ralph loop: Invalid session_id format (must be alphanumeric, dash, or underscore)" >&2
    exit 0
fi

# Check if ralph-loop is active for this session
STATE_DIR="$HOME/.claude/ralph-loop"
STATE_FILE="$STATE_DIR/ralph-loop-$SESSION_ID.local.md"
if [[ ! -f "$STATE_FILE" ]]; then
    # No active loop for this session - allow exit
    exit 0
fi

# Parse markdown frontmatter (YAML between ---) and extract values
FRONTMATTER=$(parse_frontmatter "$STATE_FILE")
ITERATION=$(get_iteration "$FRONTMATTER")
MAX_ITERATIONS=$(get_max_iterations "$FRONTMATTER")
COMPLETION_PROMISE=$(get_completion_promise "$FRONTMATTER")

# Validate numeric fields before arithmetic operations
if [[ ! "$ITERATION" =~ ^[0-9]+$ ]]; then
    echo "⚠️ Ralph loop: State file corrupted" >&2
    echo " File: $STATE_FILE" >&2
    echo " Problem: 'iteration' field is not a valid number (got: '$ITERATION')" >&2
    echo "" >&2
    echo " This usually means the state file was manually edited or corrupted." >&2
    echo " Ralph loop is stopping. Run /ralph-loop again to start fresh." >&2
    rm "$STATE_FILE"
    exit 0
fi

if [[ ! "$MAX_ITERATIONS" =~ ^[0-9]+$ ]]; then
    echo "⚠️ Ralph loop: State file corrupted" >&2
    echo " File: $STATE_FILE" >&2
    echo " Problem: 'max_iterations' field is not a valid number (got: '$MAX_ITERATIONS')" >&2
    echo "" >&2
    echo " This usually means the state file was manually edited or corrupted." >&2
    echo " Ralph loop is stopping. Run /ralph-loop again to start fresh." >&2
    rm "$STATE_FILE"
    exit 0
fi

# Check if max iterations reached
if [[ $MAX_ITERATIONS -gt 0 ]] && [[ $ITERATION -ge $MAX_ITERATIONS ]]; then
    echo "🛑 Ralph loop: Max iterations ($MAX_ITERATIONS) reached."
    rm "$STATE_FILE"
    exit 0
fi

# Get transcript path from hook input
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path')

if [[ ! -f "$TRANSCRIPT_PATH" ]]; then
    echo "⚠️ Ralph loop: Transcript file not found" >&2
    echo " Expected: $TRANSCRIPT_PATH" >&2
    echo " This is unusual and may indicate a Claude Code internal issue." >&2
    echo " Ralph loop is stopping." >&2
    rm "$STATE_FILE"
    exit 0
fi

# Read last assistant message from transcript (JSONL format - one JSON per line)
# First check if there are any assistant messages
if ! grep -q '"role":"assistant"' "$TRANSCRIPT_PATH"; then
    echo "⚠️ Ralph loop: No assistant messages found in transcript" >&2
    echo " Transcript: $TRANSCRIPT_PATH" >&2
    echo " This is unusual and may indicate a transcript format issue" >&2
    echo " Ralph loop is stopping." >&2
    rm "$STATE_FILE"
    exit 0
fi

# Extract last assistant message with explicit error handling
LAST_LINE=$(grep '"role":"assistant"' "$TRANSCRIPT_PATH" | tail -1)

if [[ -z "$LAST_LINE" ]]; then
    echo "⚠️ Ralph loop: Failed to extract last assistant message" >&2
    echo " Ralph loop is stopping." >&2
    rm "$STATE_FILE"
    exit 0
fi

# Parse JSON with error handling
LAST_OUTPUT=$(echo "$LAST_LINE" | jq -r '
    .message.content |
    map(select(.type == "text")) |
    map(.text) |
    join("\n")
' 2>/dev/null)

# Check if jq succeeded
if ! echo "$LAST_LINE" | jq -r '.message.content' >/dev/null 2>&1; then
    echo "⚠️ Ralph loop: Failed to parse assistant message JSON" >&2
    echo " This may indicate a transcript format issue" >&2
    echo " Ralph loop is stopping." >&2
    rm "$STATE_FILE"
    exit 0
fi

if [[ -z "$LAST_OUTPUT" ]]; then
    echo "⚠️ Ralph loop: Assistant message contained no text content" >&2
    echo " Ralph loop is stopping." >&2
    rm "$STATE_FILE"
    exit 0
fi

# Check for completion promise (only if set)
if [[ "$COMPLETION_PROMISE" != "null" ]] && [[ -n "$COMPLETION_PROMISE" ]]; then
    # Extract text from <promise> tags using Perl for multiline support
    # -0777 slurps entire input, s flag makes . match newlines
    # .*? is non-greedy (takes FIRST <promise> tag), whitespace normalized
    PROMISE_TEXT=$(echo "$LAST_OUTPUT" | perl -0777 -pe 's/.*?<promise>(.*?)<\/promise>.*/$1/s; s/^\s+|\s+$//g; s/\s+/ /g' 2>/dev/null || echo "")

    # Use = for literal string comparison (not pattern matching)
    # == in [[ ]] does glob pattern matching which breaks with *, ?, [ characters
    if [[ -n "$PROMISE_TEXT" ]] && [[ "$PROMISE_TEXT" = "$COMPLETION_PROMISE" ]]; then
        echo "✅ Ralph loop: Detected <promise>$COMPLETION_PROMISE</promise>"
        rm "$STATE_FILE"
        exit 0
    fi
fi

# Not complete - continue loop with SAME PROMPT
NEXT_ITERATION=$((ITERATION + 1))

# Extract prompt (everything after the closing ---)
# Skip first --- line, skip until second --- line, then print everything after
# Use i>=2 instead of i==2 to handle --- in prompt content
PROMPT_TEXT=$(awk '/^---$/{i++; next} i>=2' "$STATE_FILE")

if [[ -z "$PROMPT_TEXT" ]]; then
    echo "⚠️ Ralph loop: State file corrupted or incomplete" >&2
    echo " File: $STATE_FILE" >&2
    echo " Problem: No prompt text found" >&2
    echo "" >&2
    echo " This usually means:" >&2
    echo " • State file was manually edited" >&2
    echo " • File was corrupted during writing" >&2
    echo "" >&2
    echo " Ralph loop is stopping. Run /ralph-loop again to start fresh." >&2
    rm "$STATE_FILE"
    exit 0
fi

# Update iteration in frontmatter (portable across macOS and Linux)
# Create temp file securely with mktemp, then atomically replace
TEMP_FILE=$(mktemp "${STATE_FILE}.tmp.XXXXXX") || exit 1
trap 'rm -f "$TEMP_FILE"' EXIT
sed "s/^iteration: .*/iteration: $NEXT_ITERATION/" "$STATE_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$STATE_FILE"
trap - EXIT  # Disable trap after successful mv

# Build system message with iteration count and completion promise info
if [[ "$COMPLETION_PROMISE" != "null" ]] && [[ -n "$COMPLETION_PROMISE" ]]; then
    SYSTEM_MSG="🔄 Ralph iteration $NEXT_ITERATION | To stop: output <promise>$COMPLETION_PROMISE</promise> (ONLY when statement is TRUE - do not lie to exit!)"
else
    SYSTEM_MSG="🔄 Ralph iteration $NEXT_ITERATION | No completion promise set - loop runs infinitely"
fi

# Output JSON to block the stop and feed prompt back
# The "reason" field contains the prompt that will be sent back to Claude
jq -n \
    --arg prompt "$PROMPT_TEXT" \
    --arg msg "$SYSTEM_MSG" \
    '{
    "decision": "block",
    "reason": $prompt,
    "systemMessage": $msg
}'

# Exit 0 for successful hook execution
exit 0
