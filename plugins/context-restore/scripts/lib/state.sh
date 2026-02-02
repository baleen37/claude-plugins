#!/usr/bin/env bash
set -euo pipefail

# Context Restore State Library
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
    echo "${CONTEXT_RESTORE_SESSIONS_DIR:-$HOME/.claude/sessions}"
}

# Extract project folder from transcript_path
# Returns: project folder name (e.g., "-Users-test-dev-project-a") or empty string
extract_project_folder_from_transcript() {
    local transcript_path="$1"

    if [[ -z "$transcript_path" ]] || [[ "$transcript_path" == "null" ]]; then
        return 0
    fi

    # Use a local variable to safely check BASH_REMATCH under set -u
    # Pattern: .claude/projects/{folder-name}/...
    if [[ "$transcript_path" =~ \.claude/projects/([^/]+)/ ]]; then
        local project_folder="${BASH_REMATCH[1]:-}"
        if [[ -n "$project_folder" ]]; then
            echo "$project_folder"
        fi
    fi
}

# Get project-specific sessions directory
# Priority order:
#   1. Environment variable (CONTEXT_RESTORE_SESSIONS_DIR)
#   2. Project-specific directory (~/.claude/projects/{project-folder})
#   3. Legacy fallback (~/.claude/sessions)
get_sessions_dir_for_project() {
    local transcript_path="${1:-}"

    # Priority 1: Environment variable (for testing)
    if [[ -n "${CONTEXT_RESTORE_SESSIONS_DIR:-}" ]]; then
        echo "$CONTEXT_RESTORE_SESSIONS_DIR"
        return 0
    fi

    # Priority 2: Project-specific directory
    if [[ -n "$transcript_path" ]]; then
        local project_folder
        project_folder=$(extract_project_folder_from_transcript "$transcript_path")

        if [[ -n "$project_folder" ]]; then
            echo "$HOME/.claude/projects/$project_folder"
            return 0
        fi
    fi

    # Priority 3: Legacy fallback
    echo "$HOME/.claude/sessions"
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
    local transcript_path="${3:-}"
    local sessions_dir
    sessions_dir=$(get_sessions_dir_for_project "$transcript_path")

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
    local transcript_path="${2:-}"
    local sessions_dir
    sessions_dir=$(get_sessions_dir_for_project "$transcript_path")

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

# Check if transcript contains /compact command
# Input: transcript_path (JSONL file path)
# Output: 0 (found) or 1 (not found)
# Error: Warning to stderr, does not fail hook
has_compact_command() {
    local transcript_path="$1"

    if [[ ! -f "$transcript_path" ]]; then
        echo "Warning: has_compact_command: Transcript file not found: $transcript_path" >&2
        return 1
    fi

    # Search for /compact command pattern in transcript
    # Pattern: <command-name>/compact</command-name>
    if grep -q '<command-name>/compact</command-name>' "$transcript_path"; then
        return 0
    else
        return 1
    fi
}

# Extract transcript path from session file
# Input: session_file (.md file path)
# Output: transcript path or empty string
extract_transcript_path_from_session() {
    local session_file="$1"

    if [[ ! -f "$session_file" ]]; then
        return 0
    fi

    # Extract from "- Transcript: /path/to/file.jsonl" line
    # Use grep + sed for cross-platform compatibility
    grep -E '^- Transcript:' "$session_file" 2>/dev/null | sed -E 's/^- Transcript:[[:space:]]*//'
}

# Extract timestamp from session file
# Input: session_file (.md file path)
# Output: "YYYY-MM-DD HH:MM:SS" format or empty string
extract_timestamp_from_session() {
    local session_file="$1"

    if [[ ! -f "$session_file" ]]; then
        return 0
    fi

    # Priority 1: Extract from "- End Time: YYYY-MM-DD HH:MM:SS" line
    local end_time
    end_time=$(grep -E '^- End Time:' "$session_file" 2>/dev/null | sed -E 's/^- End Time:[[:space:]]*//')

    if [[ -n "$end_time" ]]; then
        echo "$end_time"
        return 0
    fi

    # Priority 2: Fallback - Check "# Date: YYYY-MM-DD HH:MM:SS" line
    local date_line
    date_line=$(grep -E '^# Date:' "$session_file" 2>/dev/null | sed -E 's/^# Date:[[:space:]]*//')

    if [[ -n "$date_line" ]]; then
        echo "$date_line"
        return 0
    fi

    # No timestamp found
    return 0
}

# Return timestamp of most recent session containing /compact
# Input: sessions_dir (directory containing session files)
# Output: timestamp or empty string (no /compact found)
find_most_recent_compact_session() {
    local sessions_dir="$1"

    if [[ ! -d "$sessions_dir" ]]; then
        return 0
    fi

    # Sort session files by time with ls -t (newest first)
    local session_files
    session_files=$(ls -t "$sessions_dir"/session-*.md 2>/dev/null)

    if [[ -z "$session_files" ]]; then
        return 0
    fi

    # Search each session's transcript for /compact
    while IFS= read -r session_file; do
        local transcript_path
        transcript_path=$(extract_transcript_path_from_session "$session_file")

        if [[ -z "$transcript_path" ]]; then
            continue
        fi

        # Check if transcript contains /compact
        if has_compact_command "$transcript_path"; then
            # Found /compact, return this session's timestamp
            local timestamp
            timestamp=$(extract_timestamp_from_session "$session_file")

            if [[ -n "$timestamp" ]]; then
                echo "$timestamp"
                return 0
            fi
        fi
    done <<< "$session_files"

    # No /compact found in any session
    return 0
}

# Return recent sessions created after /compact
# Input: count (max number, default 5), transcript_path (for project detection)
# Output: session file paths (newline-separated)
find_recent_sessions_after_compact() {
    local count="${1:-5}"
    local transcript_path="${2:-}"
    local sessions_dir
    sessions_dir=$(get_sessions_dir_for_project "$transcript_path")

    if [[ ! -d "$sessions_dir" ]]; then
        return 0
    fi

    # Get compact timestamp
    local compact_timestamp
    compact_timestamp=$(find_most_recent_compact_session "$sessions_dir")

    # If no compact timestamp: return all recent sessions (current behavior)
    if [[ -z "$compact_timestamp" ]]; then
        find_recent_sessions "$count" "$transcript_path"
        return 0
    fi

    # If compact timestamp exists: filter sessions after that timestamp only
    local all_sessions
    all_sessions=$(ls -t "$sessions_dir"/session-*.md 2>/dev/null)

    if [[ -z "$all_sessions" ]]; then
        return 0
    fi

    # Filter sessions created after compact_timestamp
    local filtered_sessions=()
    while IFS= read -r session_file; do
        local session_timestamp
        session_timestamp=$(extract_timestamp_from_session "$session_file")

        if [[ -z "$session_timestamp" ]]; then
            continue
        fi

        # Timestamp comparison: Simple string comparison works for ISO format
        # "YYYY-MM-DD HH:MM:SS" format allows lexicographic comparison
        if [[ "$session_timestamp" > "$compact_timestamp" ]]; then
            filtered_sessions+=("$session_file")
        fi
    done <<< "$all_sessions"

    # Return up to count sessions
    local result_count=0
    for session_file in "${filtered_sessions[@]}"; do
        if [[ $result_count -ge $count ]]; then
            break
        fi
        echo "$session_file"
        ((result_count++)) || true
    done
}
