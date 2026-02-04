#!/usr/bin/env bats
# Test: GitHub Actions workflows configuration

load helpers/bats_helper

# Path to workflow files
WORKFLOW_DIR="${PROJECT_ROOT}/.github/workflows"
CI_WORKFLOW="${WORKFLOW_DIR}/ci.yml"

# Helper: Parse YAML and extract value using yq
# Usage: yaml_get <file> <yaml_path>
# Example: yaml_get workflow.yml '.jobs.release.if'
yaml_get() {
    local file="$1"
    local path="$2"

    yq eval "$path" "$file" 2>/dev/null
}

# Helper: Check if workflow has specific trigger
workflow_has_trigger() {
    local workflow_file="$1"
    local trigger_type="$2"
    yaml_get "$workflow_file" ".on.${trigger_type}" &>/dev/null
}

# Helper: Check if job has 'if' condition
job_has_if_condition() {
    local workflow_file="$1"
    local job_name="$2"
    yaml_get "$workflow_file" ".jobs.${job_name}.if" &>/dev/null
}

# Helper: Ensure yq is available (call in tests that need yq)
ensure_yq() {
    if ! command -v yq &> /dev/null; then
        skip "yq not available"
    fi
}

@test "Workflow directory exists" {
    [ -d "$WORKFLOW_DIR" ]
}

@test "CI workflow file exists" {
    [ -f "$CI_WORKFLOW" ]
    [ -s "$CI_WORKFLOW" ]
}

@test "CI workflow has valid YAML syntax" {
    ensure_yq
    yaml_get "$CI_WORKFLOW" "." >/dev/null
}

@test "CI workflow triggers on push to main" {
    ensure_yq
    workflow_has_trigger "$CI_WORKFLOW" "push"
}

@test "CI workflow triggers on pull_request" {
    ensure_yq
    workflow_has_trigger "$CI_WORKFLOW" "pull_request"
}

@test "CI workflow has only test job (no release job)" {
    ensure_yq
    # CI workflow should only have test job, release is now handled by Release Please
    local jobs
    jobs=$(yaml_get "$CI_WORKFLOW" ".jobs | keys | .[]")

    [[ "$jobs" == "test" ]]

    # Verify release job doesn't exist (should return "null")
    local release_job
    release_job=$(yaml_get "$CI_WORKFLOW" ".jobs.release")
    [[ "$release_job" == "null" ]]
}

@test "CI workflow has read-only permissions" {
    ensure_yq
    local permissions
    permissions=$(yaml_get "$CI_WORKFLOW" ".permissions.contents")

    [[ "$permissions" == "read" ]]
}

@test "Release Please workflow exists" {
    [ -f "${WORKFLOW_DIR}/release-please.yml" ]
}

@test "Release Please workflow has valid YAML syntax" {
    ensure_yq
    yaml_get "${WORKFLOW_DIR}/release-please.yml" "." >/dev/null
}

@test "Release Please workflow triggers on push to main" {
    ensure_yq
    workflow_has_trigger "${WORKFLOW_DIR}/release-please.yml" "push"
    local branches
    branches=$(yaml_get "${WORKFLOW_DIR}/release-please.yml" ".on.push.branches.[]")
    [[ "$branches" == "main" ]]
}

@test "Release Please workflow has required permissions" {
    ensure_yq
    local contents_perm
    contents_perm=$(yaml_get "${WORKFLOW_DIR}/release-please.yml" ".permissions.contents")
    [[ "$contents_perm" == "write" ]]

    local pr_perm
    pr_perm=$(yaml_get "${WORKFLOW_DIR}/release-please.yml" ".permissions.pull-requests")
    [[ "$pr_perm" == "write" ]]
}

@test "Marketplace sync workflow exists" {
    [ -f "${WORKFLOW_DIR}/sync-marketplace.yml" ]
}

@test "Marketplace sync workflow has valid YAML syntax" {
    ensure_yq
    yaml_get "${WORKFLOW_DIR}/sync-marketplace.yml" "." >/dev/null
}

@test "Release Please workflow uses googleapis action" {
    ensure_yq
    # Verify that the workflow uses the official release-please action
    local uses
    uses=$(yaml_get "${WORKFLOW_DIR}/release-please.yml" ".jobs.release-please.steps.[0].uses")

    [[ "$uses" == *"googleapis/release-please-action@v4"* ]]
}
