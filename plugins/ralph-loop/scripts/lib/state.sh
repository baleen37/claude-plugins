#!/usr/bin/env bash
set -euo pipefail

# Ralph Loop State Library
# Provides functions for parsing and validating Ralph Loop state files

# Project registry file
PROJECT_REGISTRY="$HOME/.claude/ralph-loop/projects.json"

validate_session_id() {
    local session_id="$1"
    if [[ ! "$session_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Warning: Invalid session_id format" >&2
        return 1
    fi
}

# Get or create project UUID from project path
get_or_create_project_uuid() {
    local project_path="$1"
    local project_uuid

    # Create registry directory if not exists
    mkdir -p "$(dirname "$PROJECT_REGISTRY")"

    # Create registry file if not exists
    if [[ ! -f "$PROJECT_REGISTRY" ]]; then
        echo "{}" > "$PROJECT_REGISTRY"
    fi

    # Look up existing UUID
    project_uuid=$(jq -r --arg path "$project_path" '.[$path]' "$PROJECT_REGISTRY" 2>/dev/null || echo "null")

    # If not found, create new UUID and save
    if [[ "$project_uuid" == "null" ]] || [[ -z "$project_uuid" ]]; then
        project_uuid=$(uuidgen)
        # Update registry using tmp file for atomic write
        local tmp_file
        tmp_file=$(mktemp "${PROJECT_REGISTRY}.tmp.XXXXXX")
        jq --arg path "$project_path" --arg uuid "$project_uuid" '. + {($path): $uuid}' "$PROJECT_REGISTRY" > "$tmp_file"
        mv "$tmp_file" "$PROJECT_REGISTRY"
    fi

    echo "$project_uuid"
}

parse_frontmatter() {
    local state_file="$1"
    sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$state_file"
}

get_iteration() {
    local frontmatter="$1"
    echo "$frontmatter" | grep -m 1 '^iteration:' | sed 's/iteration: *//'
}

get_max_iterations() {
    local frontmatter="$1"
    echo "$frontmatter" | grep -m 1 '^max_iterations:' | sed 's/max_iterations: *//'
}

get_completion_promise() {
    local frontmatter="$1"
    echo "$frontmatter" | grep -m 1 '^completion_promise:' | sed 's/completion_promise: *//' | sed 's/^"\(.*\)"$/\1/'
}
