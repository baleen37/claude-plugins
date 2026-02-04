#!/usr/bin/env bats
# Me plugin-specific tests
# Basic validation is handled in tests/ directory

load ../../../packages/bats-helpers/src/bats_helper

PLUGIN_DIR="${PROJECT_ROOT}/plugins/me"

@test "me: has all workflow commands" {
    [ -f "${PLUGIN_DIR}/commands/brainstorm.md" ]
    [ -f "${PLUGIN_DIR}/commands/debugging.md" ]
    [ -f "${PLUGIN_DIR}/commands/orchestrate.md" ]
    [ -f "${PLUGIN_DIR}/commands/refactor-clean.md" ]
    [ -f "${PLUGIN_DIR}/commands/research.md" ]
    [ -f "${PLUGIN_DIR}/commands/sdd.md" ]
    [ -f "${PLUGIN_DIR}/commands/verify.md" ]
    [ -f "${PLUGIN_DIR}/commands/tdd.md" ]
    [ -f "${PLUGIN_DIR}/commands/spawn.md" ]
    [ -f "${PLUGIN_DIR}/commands/claude-isolated-test.md" ]
}

@test "me: code-reviewer agent exists with proper model" {
    local agent_file="${PLUGIN_DIR}/agents/code-reviewer.md"
    [ -f "$agent_file" ]
    has_frontmatter_field "$agent_file" "model"
}

# create-pr skill tests
@test "me: create-pr skill exists with required components" {
    [ -d "${PLUGIN_DIR}/skills/create-pr" ]
    [ -f "${PLUGIN_DIR}/skills/create-pr/SKILL.md" ]
    [ -f "${PLUGIN_DIR}/skills/create-pr/scripts/check-conflicts.sh" ]
    [ -f "${PLUGIN_DIR}/skills/create-pr/scripts/verify-pr-status.sh" ]
}

@test "me: create-pr skill has proper frontmatter" {
    local skill_file="${PLUGIN_DIR}/skills/create-pr/SKILL.md"
    has_frontmatter_delimiter "$skill_file"
    has_frontmatter_field "$skill_file" "name"
    has_frontmatter_field "$skill_file" "description"
}

@test "me: create-pr scripts are executable" {
    [ -x "${PLUGIN_DIR}/skills/create-pr/scripts/check-conflicts.sh" ]
    [ -x "${PLUGIN_DIR}/skills/create-pr/scripts/verify-pr-status.sh" ]
}

@test "me: create-pr check-conflicts.sh validates arguments and git repo" {
    local script="${PLUGIN_DIR}/skills/create-pr/scripts/check-conflicts.sh"
    grep -q "if.*#.*ne 1" "$script"
    grep -q "git rev-parse.*git-dir" "$script"
}

@test "me: create-pr verify-pr-status.sh handles all PR states with CI checks" {
    local script="${PLUGIN_DIR}/skills/create-pr/scripts/verify-pr-status.sh"
    grep -q "CLEAN)" "$script"
    grep -q "BEHIND)" "$script"
    grep -q "DIRTY)" "$script"
    grep -q "statusCheckRollup" "$script"
    grep -q "isRequired" "$script"
    grep -q "MAX_RETRIES" "$script"
}
