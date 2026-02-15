#!/usr/bin/env bats
load ../../../packages/bats-helpers/src/bats_helper

PLUGIN_DIR="${PROJECT_ROOT}/plugins/jira"

@test "jira: plugin.json exists and is valid" {
    [ -f "${PLUGIN_DIR}/.claude-plugin/plugin.json" ]
    jq empty "${PLUGIN_DIR}/.claude-plugin/plugin.json"
}

@test "jira: .mcp.json exists and is valid" {
    [ -f "${PLUGIN_DIR}/.mcp.json" ]
    jq empty "${PLUGIN_DIR}/.mcp.json"
}

@test "jira: .mcp.json contains atlassian server config" {
    grep -q "atlassian" "${PLUGIN_DIR}/.mcp.json"
    grep -q "https://mcp.atlassian.com/v1/mcp" "${PLUGIN_DIR}/.mcp.json"
}

@test "jira: all 5 skills exist with SKILL.md" {
    [ -f "${PLUGIN_DIR}/skills/triage-issue/SKILL.md" ]
    [ -f "${PLUGIN_DIR}/skills/capture-tasks-from-meeting-notes/SKILL.md" ]
    [ -f "${PLUGIN_DIR}/skills/generate-status-report/SKILL.md" ]
    [ -f "${PLUGIN_DIR}/skills/search-company-knowledge/SKILL.md" ]
    [ -f "${PLUGIN_DIR}/skills/spec-to-backlog/SKILL.md" ]
}

@test "jira: skills have valid frontmatter" {
    for skill_dir in "${PLUGIN_DIR}"/skills/*/; do
        skill_file="${skill_dir}SKILL.md"
        [ -f "${skill_file}" ]
        grep -q "^---$" "${skill_file}"
        grep -q "^name:" "${skill_file}"
        grep -q "^description:" "${skill_file}"
    done
}
