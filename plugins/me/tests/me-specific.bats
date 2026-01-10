#!/usr/bin/env bats
# Me plugin-specific tests
# Basic validation is handled in tests/ directory

load ../../../tests/helpers/bats_helper

PLUGIN_DIR="${PROJECT_ROOT}/plugins/me"

@test "me: has all workflow commands" {
    [ -f "${PLUGIN_DIR}/commands/debug.md" ]
    [ -f "${PLUGIN_DIR}/commands/research.md" ]
    [ -f "${PLUGIN_DIR}/commands/pickup.md" ]
    [ -f "${PLUGIN_DIR}/commands/handoff.md" ]
    [ -f "${PLUGIN_DIR}/commands/sdd.md" ]
}

@test "me: code-reviewer agent exists with proper model" {
    local agent_file="${PLUGIN_DIR}/agents/code-reviewer.md"
    [ -f "$agent_file" ]
    has_frontmatter_field "$agent_file" "model"
}

@test "me: git-exclude command exists" {
    [ -f "${PLUGIN_DIR}/commands/git-exclude.md" ]
}

@test "me: web-browser skill exists" {
    [ -f "${PLUGIN_DIR}/skills/web-browser/SKILL.md" ]
}
