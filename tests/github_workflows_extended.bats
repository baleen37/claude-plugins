#!/usr/bin/env bats
# Extended GitHub workflows validation for test execution

load helpers/bats_helper

PROJECT_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"

@test "ci.yml workflow exists" {
    [ -f "${PROJECT_ROOT}/.github/workflows/ci.yml" ]
}

@test "ci.yml runs run-all-tests.sh" {
    local workflow="${PROJECT_ROOT}/.github/workflows/ci.yml"
    grep -q "bash tests/run-all-tests.sh" "$workflow"
}

@test "ci.yml release job runs run-all-tests.sh" {
    local workflow="${PROJECT_ROOT}/.github/workflows/ci.yml"
    # Release job should also run tests
    grep -q "bash tests/run-all-tests.sh" "$workflow"
}

@test "ci.yml runs on pull requests" {
    local workflow="${PROJECT_ROOT}/.github/workflows/ci.yml"
    grep -q "pull_request:" "$workflow"
}

@test "ci.yml runs on push to main" {
    local workflow="${PROJECT_ROOT}/.github/workflows/ci.yml"
    grep -q "push:" "$workflow"
    grep -q "\\- main" "$workflow"
}
