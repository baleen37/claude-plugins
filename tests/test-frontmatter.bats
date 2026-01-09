#!/usr/bin/env bats

@test "SKILL.md files have frontmatter delimiters" {
    find . -path "*/skills/*/SKILL.md" -type f | while read -r file; do
        head -1 "$file" | grep -q "^---"
    done
}

@test "SKILL.md files have required fields" {
    find . -path "*/skills/*/SKILL.md" -type f | while read -r file; do
        grep -q "^name:" "$file"
        grep -q "^description:" "$file"
    done
}

@test "Command files have frontmatter delimiters" {
    find . -path "*/commands/*.md" -type f | while read -r file; do
        head -1 "$file" | grep -q "^---"
    done
}

@test "Agent files have frontmatter delimiters" {
    find . -path "*/agents/*.md" -type f | while read -r file; do
        head -1 "$file" | grep -q "^---"
    done
}
