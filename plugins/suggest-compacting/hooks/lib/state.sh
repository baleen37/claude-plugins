#!/usr/bin/env bash
# Strategic Compact State Library
# Provides functions for validating session IDs and managing state

validate_session_id() {
    local session_id="$1"
    if [[ ! "$session_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Warning: Invalid session_id format: '$session_id'" >&2
        return 1
    fi
    return 0
}
