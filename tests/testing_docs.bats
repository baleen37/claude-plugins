#!/usr/bin/env bats
# Documentation validation for testing

load helpers/bats_helper

PROJECT_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"

@test "docs/TESTING.md exists" {
    [ -f "${PROJECT_ROOT}/docs/TESTING.md" ]
}

@test "docs/TESTING.md documents run-all-tests.sh" {
    local doc="${PROJECT_ROOT}/docs/TESTING.md"
    grep -q "run-all-tests.sh" "$doc"
}

@test "docs/TESTING.md documents plugin testing structure" {
    local doc="${PROJECT_ROOT}/docs/TESTING.md"
    grep -q "plugins.*tests" "$doc"
}

@test "docs/TESTING.md shows individual plugin test command" {
    local doc="${PROJECT_ROOT}/docs/TESTING.md"
    grep -q "bats plugins.*/tests/" "$doc"
}

@test "docs/TESTING.md shows helper loading path" {
    local doc="${PROJECT_ROOT}/docs/TESTING.md"
    grep -q "load.*tests/helpers/bats_helper" "$doc"
}

@test "docs/TESTING.md documents plugin test structure" {
    local doc="${PROJECT_ROOT}/docs/TESTING.md"
    grep -q "plugins/{plugin-name}/" "$doc"
}
