#!/usr/bin/env bash
set -euo pipefail

# Memory Persistence State Library
# Provides utilities for session and skills management

validate_session_id() {
    local session_id="$1"
    if [[ ! "$session_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Warning: Invalid session_id format: '$session_id'" >&2
        return 1
    fi
    return 0
}

get_sessions_dir() {
    # Support environment variable override for testing
    echo "${MEMORY_PERSISTENCE_SESSIONS_DIR:-$HOME/.claude/sessions}"
}

ensure_directory_exists() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        mkdir -p "$dir" || {
            echo "Error: Could not create directory: $dir" >&2
            return 1
        }
    fi
}

save_session_file() {
    local session_id="$1"
    local content="$2"
    local sessions_dir
    sessions_dir=$(get_sessions_dir)

    ensure_directory_exists "$sessions_dir" || return 1

    local timestamp
    timestamp=$(date +%Y%m%d-%H%M%S)
    local session_file="$sessions_dir/session-${session_id}-${timestamp}.md"

    echo "$content" > "$session_file" || {
        echo "Error: Could not write session file: $session_file" >&2
        return 1
    }

    echo "$session_file"
}

find_recent_sessions() {
    local count="${1:-5}"
    local sessions_dir
    sessions_dir=$(get_sessions_dir)

    if [[ ! -d "$sessions_dir" ]]; then
        return 0
    fi

    # Cross-platform approach using ls -t (works on macOS and Linux)
    # ls -t sorts by modification time, newest first
    ls -t "$sessions_dir"/session-*.md 2>/dev/null | head -n "$count"
}

extract_assistant_message_from_transcript() {
    local transcript_path="$1"

    if [[ ! -f "$transcript_path" ]]; then
        echo "Error: Transcript file not found: $transcript_path" >&2
        return 1
    fi

    # Extract last assistant message from JSONL transcript
    # JSONL format: one JSON object per line
    # We look for lines with "role": "assistant" and take the last one
    # Use grep with flexible pattern to handle whitespace variations
    if ! grep -q '"role"[[:space:]]*:[[:space:]]*"assistant"' "$transcript_path"; then
        echo "Warning: No assistant messages found in transcript" >&2
        return 1
    fi

    local last_line
    last_line=$(grep '"role"[[:space:]]*:[[:space:]]*"assistant"' "$transcript_path" | tail -1)

    if [[ -z "$last_line" ]]; then
        echo "Warning: Failed to extract assistant message" >&2
        return 1
    fi

    # Parse JSON and extract text content
    # Message structure (verified from ralph-loop stop-hook.sh):
    # .message.content is an array of {type: "text", text: "..."}
    echo "$last_line" | jq -r '
        .message.content |
        map(select(.type == "text")) |
        map(.text) |
        join("\n")
    ' 2>/dev/null
}
