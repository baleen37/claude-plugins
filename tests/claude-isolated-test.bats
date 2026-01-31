#!/usr/bin/env bats

# Tests for claude-isolated-test skill
# This skill uses packnplay CLI directly - no wrapper script

setup() {
    # Find skill directory relative to test file
    SKILL_DIR="$(cd "${BATS_TEST_DIRNAME}/../plugins/me/skills/claude-isolated-test" && pwd)"
}

# ===== PREREQUISITE TESTS =====

@test "SKILL.md exists" {
    [ -f "$SKILL_DIR/SKILL.md" ]
}

@test "SKILL.md has valid frontmatter" {
    run grep -q '^---$' "$SKILL_DIR/SKILL.md"
    [ "$status" -eq 0 ]
}

@test "SKILL.md documents packnplay CLI usage" {
    run grep -q 'packnplay run' "$SKILL_DIR/SKILL.md"
    [ "$status" -eq 0 ]
}

@test "SKILL.md documents installation" {
    run grep -q 'go install github.com/obra/packnplay' "$SKILL_DIR/SKILL.md"
    [ "$status" -eq 0 ]
}

@test "SKILL.md documents authentication" {
    run grep -q 'ANTHROPIC_API_KEY' "$SKILL_DIR/SKILL.md"
    [ "$status" -eq 0 ]
}

# Note: packnplay installation and execution tests require E2E tests
# Install packnplay with: go install github.com/obra/packnplay@latest
