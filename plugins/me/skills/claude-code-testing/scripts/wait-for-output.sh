#!/bin/bash
# Reusable polling helper for tmux output
# Usage: source ./scripts/wait-for-output.sh
#        wait_for_output "session-name" "expected-text" [max-attempts]

wait_for_output() {
    local session="$1"
    local expected="$2"
    local max_attempts="${3:-20}"
    local attempts=0

    while [ $attempts -lt $max_attempts ]; do
        OUTPUT=$(tmux capture-pane -t "$session" -p 2>/dev/null || echo "")
        if echo "$OUTPUT" | grep -q "$expected"; then
            return 0
        fi
        sleep 0.5
        attempts=$((attempts + 1))
    done

    echo "Timeout waiting for: $expected" >&2
    tmux capture-pane -t "$session" -p >&2
    return 1
}
