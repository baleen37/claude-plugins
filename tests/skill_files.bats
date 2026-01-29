#!/usr/bin/env bats
# Test: SKILL.md files have valid frontmatter

load helpers/bats_helper

@test "SKILL.md files exist" {
    local skill_count
    skill_count=$(count_files "SKILL.md" "${PROJECT_ROOT}")
    [ "$skill_count" -gt 0 ]
}

@test "SKILL.md files have valid frontmatter delimiter" {
    while IFS= read -r -d '' file; do
        has_frontmatter_delimiter "$file"
    done < <(find "${PROJECT_ROOT}" -name "SKILL.md" -type f -print0 2>/dev/null)
}

@test "SKILL.md files have name field" {
    while IFS= read -r -d '' file; do
        has_frontmatter_field "$file" "name"
    done < <(find "${PROJECT_ROOT}" -name "SKILL.md" -type f -print0 2>/dev/null)
}

@test "SKILL.md files have description field" {
    while IFS= read -r -d '' file; do
        has_frontmatter_field "$file" "description"
    done < <(find "${PROJECT_ROOT}" -name "SKILL.md" -type f -print0 2>/dev/null)
}
