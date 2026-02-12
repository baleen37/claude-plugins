#!/usr/bin/env bats
# Me plugin-specific tests
# Tests for structural integrity and correctness of me plugin components

load ../../../packages/bats-helpers/src/bats_helper

PLUGIN_DIR="${PROJECT_ROOT}/plugins/me"

# ===========================================
# Command Tests
# ===========================================

@test "me: all commands have required frontmatter fields" {
    local commands_dir="${PLUGIN_DIR}/commands"
    for cmd in "$commands_dir"/*.md; do
        [ -f "$cmd" ] || continue
        has_frontmatter_delimiter "$cmd"
        has_frontmatter_field "$cmd" "name"
        has_frontmatter_field "$cmd" "description"
    done
}

@test "me: all commands have meaningful content" {
    local commands_dir="${PLUGIN_DIR}/commands"
    for cmd in "$commands_dir"/*.md; do
        [ -f "$cmd" ] || continue
        # Commands should have content beyond frontmatter
        local content
        content=$(sed '/^---$/,/^---$/d' "$cmd")
        [ -n "$(echo "$content" | tr -d '[:space:]')" ]
    done
}

# ===========================================
# Agent Tests
# ===========================================

@test "me: code-reviewer agent has required fields" {
    local agent_file="${PLUGIN_DIR}/agents/code-reviewer.md"
    [ -f "$agent_file" ]
    has_frontmatter_delimiter "$agent_file"
    has_frontmatter_field "$agent_file" "model"
    has_frontmatter_field "$agent_file" "description"
}

# ===========================================
# create-pr Skill Tests
# ===========================================

@test "me: create-pr skill has valid structure" {
    local skill_file="${PLUGIN_DIR}/skills/create-pr/SKILL.md"
    [ -f "$skill_file" ]
    has_frontmatter_delimiter "$skill_file"
    has_frontmatter_field "$skill_file" "name"
    has_frontmatter_field "$skill_file" "description"
}

@test "me: create-pr scripts have proper error handling" {
    local scripts_dir="${PLUGIN_DIR}/skills/create-pr/scripts"
    for script in "$scripts_dir"/*.sh; do
        [ -f "$script" ] || continue
        # All scripts should use strict mode
        grep -q "set -euo pipefail" "$script"
    done
}

@test "me: create-pr scripts are executable" {
    [ -x "${PLUGIN_DIR}/skills/create-pr/scripts/check-conflicts.sh" ]
    [ -x "${PLUGIN_DIR}/skills/create-pr/scripts/verify-pr-status.sh" ]
}

@test "me: check-conflicts.sh validates git repository" {
    local script="${PLUGIN_DIR}/skills/create-pr/scripts/check-conflicts.sh"
    # Should check for git repo before proceeding
    grep -q "git rev-parse.*git-dir" "$script"
    # Should use merge-tree for conflict detection (more reliable than --no-commit)
    grep -q "merge-tree" "$script"
}

@test "me: verify-pr-status.sh handles all PR states" {
    local script="${PLUGIN_DIR}/skills/create-pr/scripts/verify-pr-status.sh"
    # Should handle all possible merge states
    grep -q "CLEAN)" "$script"
    grep -q "BEHIND)" "$script"
    grep -q "DIRTY)" "$script"
    grep -q "BLOCKED\|UNSTABLE)" "$script"
}

@test "me: verify-pr-status.sh checks required CI status" {
    local script="${PLUGIN_DIR}/skills/create-pr/scripts/verify-pr-status.sh"
    # Should verify CI status before declaring merge-ready
    grep -q "statusCheckRollup" "$script"
    grep -q "isRequired" "$script"
}

@test "me: verify-pr-status.sh has retry logic for BEHIND state" {
    local script="${PLUGIN_DIR}/skills/create-pr/scripts/verify-pr-status.sh"
    # Should have retry mechanism for automatic branch updates
    grep -q "MAX_RETRIES" "$script"
    grep -q "RETRY_COUNT" "$script"
}

# ===========================================
# Script Behavior Tests (with fixtures)
# ===========================================

@test "me: check-conflicts.sh exits with code 2 outside git repo" {
    local script="${PLUGIN_DIR}/skills/create-pr/scripts/check-conflicts.sh"
    # Create temp directory that is not a git repo
    local temp_dir
    temp_dir=$(mktemp -d)
    # Run script from non-git directory
    cd "$temp_dir"
    run "$script" main
    [ "$status" -eq 2 ]
    rm -rf "$temp_dir"
}
