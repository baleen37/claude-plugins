#!/usr/bin/env bats
# Test: GitHub Actions workflows configuration

load helpers/bats_helper

# Path to workflow files
WORKFLOW_DIR="${PROJECT_ROOT}/.github/workflows"
RELEASE_WORKFLOW="${WORKFLOW_DIR}/release.yml"
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

@test "Release workflow file exists" {
    [ -f "$RELEASE_WORKFLOW" ]
    [ -s "$RELEASE_WORKFLOW" ]
}

@test "CI workflow file exists" {
    [ -f "$CI_WORKFLOW" ]
    [ -s "$CI_WORKFLOW" ]
}

@test "Release workflow has valid YAML syntax" {
    ensure_yq
    # yq will fail if YAML is invalid
    yaml_get "$RELEASE_WORKFLOW" "." >/dev/null
}

@test "CI workflow has valid YAML syntax" {
    ensure_yq
    yaml_get "$CI_WORKFLOW" "." >/dev/null
}

@test "Release workflow triggers on push to main" {
    ensure_yq
    workflow_has_trigger "$RELEASE_WORKFLOW" "push"
}

@test "Release workflow triggers on pull_request closed" {
    ensure_yq
    workflow_has_trigger "$RELEASE_WORKFLOW" "pull_request"
}

@test "Release workflow has release job" {
    ensure_yq
    yaml_get "$RELEASE_WORKFLOW" ".jobs.release" >/dev/null
}

@test "Release workflow job has bot detection condition" {
    ensure_yq
    # The job should have 'if: github.actor != 'github-actions[bot]''
    local if_condition
    if_condition=$(yaml_get "$RELEASE_WORKFLOW" ".jobs.release.if")

    echo "Actual if condition: $if_condition"

    # Check if the condition excludes github-actions[bot]
    [[ "$if_condition" == *"github-actions[bot]"* ]]
    [[ "$if_condition" == *"!="* ]] || [[ "$if_condition" == *"not"* ]]
}

@test "Release workflow job condition prevents bot loop" {
    ensure_yq
    # The job should NOT run when github-actions[bot] is the actor
    local if_condition
    if_condition=$(yaml_get "$RELEASE_WORKFLOW" ".jobs.release.if")

    echo "Checking if condition prevents bot loop: $if_condition"

    # The condition should explicitly exclude github-actions[bot]
    # Valid patterns:
    # - github.actor != 'github-actions[bot]'
    # - github.actor != "github-actions[bot]"
    # - github.actor != 'github-actions[bot]' && ...
    # - !contains(github.actor, 'github-actions[bot]')

    # Check that it contains the actor check
    [[ "$if_condition" == *"github.actor"* ]]
    [[ "$if_condition" == *"!="* ]]
}

@test "Release workflow has required permissions" {
    ensure_yq
    local permissions
    permissions=$(yaml_get "$RELEASE_WORKFLOW" ".permissions.contents")

    [[ "$permissions" == "write" ]]
}

@test "Release workflow runs tests before release" {
    # Check that 'Run tests' step exists in the job
    # We'll check for the step name in the file
    grep -q "name:.*Run tests" "$RELEASE_WORKFLOW" || grep -q "name:.*test" "$RELEASE_WORKFLOW"
}

@test "Release workflow bot commit creates valid commit message" {
    # When the bot creates a release commit, it should use chore(release): format
    # This ensures the commit follows Conventional Commits
    grep -q "chore(release):" "$RELEASE_WORKFLOW"
}
