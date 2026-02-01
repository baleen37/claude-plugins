#!/usr/bin/env bats
# Test: Agent files have valid frontmatter

load helpers/bats_helper

@test "Agent files exist in plugins" {
    local agent_count
    agent_count=$(find "${PROJECT_ROOT}/plugins" -path "*/agents/*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    [ "$agent_count" -gt 0 ]
}

@test "Agent files have frontmatter delimiter" {
    while IFS= read -r -d '' file; do
        # Skip CLAUDE.md files (documentation, not agents)
        [[ "$(basename "$file")" == "CLAUDE.md" ]] && continue
        has_frontmatter_delimiter "$file"
    done < <(find "${PROJECT_ROOT}/plugins" -path "*/agents/*.md" -type f -print0 2>/dev/null)
}
