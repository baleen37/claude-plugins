#!/usr/bin/env bats
# Test: Command files have valid frontmatter

load helpers/bats_helper

@test "Command files exist in plugins" {
    local command_count
    command_count=$(find "${PROJECT_ROOT}/plugins" -path "*/commands/*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    [ "$command_count" -gt 0 ]
}

@test "Command files have frontmatter delimiter" {
    while IFS= read -r -d '' file; do
        # Skip CLAUDE.md files (documentation, not commands)
        [[ "$(basename "$file")" == "CLAUDE.md" ]] && continue
        has_frontmatter_delimiter "$file"
    done < <(find "${PROJECT_ROOT}/plugins" -path "*/commands/*.md" -type f -print0 2>/dev/null)
}
