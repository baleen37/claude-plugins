#!/usr/bin/env bash
set -euo pipefail

# Ralph Loop State Library
# Provides functions for parsing and validating Ralph Loop state files

validate_session_id() {
    local session_id="$1"
    if [[ ! "$session_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Warning: Invalid session_id format" >&2
        return 1
    fi
}

parse_frontmatter() {
    local state_file="$1"
    sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$state_file"
}

get_iteration() {
    local frontmatter="$1"
    echo "$frontmatter" | grep '^iteration:' | sed 's/iteration: *//'
}

get_max_iterations() {
    local frontmatter="$1"
    echo "$frontmatter" | grep '^max_iterations:' | sed 's/max_iterations: *//'
}

get_completion_promise() {
    local frontmatter="$1"
    echo "$frontmatter" | grep '^completion_promise:' | sed 's/completion_promise: *//' | sed 's/^"\(.*\)"$/\1/'
}
