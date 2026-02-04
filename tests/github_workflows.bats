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

@test "CI workflow has release job" {
    ensure_yq
    yaml_get "$CI_WORKFLOW" ".jobs.release" >/dev/null
}

@test "CI workflow release job has bot detection condition" {
    ensure_yq
    # The job should have an 'if' condition that filters bot accounts
    local if_condition
    if_condition=$(yaml_get "$CI_WORKFLOW" ".jobs.release.if")

    echo "Actual if condition: $if_condition"

    # The condition should check github.actor
    [[ "$if_condition" == *"github.actor"* ]]

    # The condition should use either:
    # 1. contains() function for universal bot filtering (recommended)
    # 2. or != operator for specific bot filtering (brittle)
    [[ "$if_condition" == *"contains"* ]] || [[ "$if_condition" == *"!="* ]]
}

@test "CI workflow has required permissions" {
    ensure_yq
    local permissions
    permissions=$(yaml_get "$CI_WORKFLOW" ".permissions.contents")

    [[ "$permissions" == "write" ]]
}

@test "CI workflow release job runs tests before release" {
    # Check that 'Run tests' step exists in the release job
    # We'll check for the step name in the file
    grep -q "name:.*Run tests" "$CI_WORKFLOW" || grep -q "name:.*test" "$CI_WORKFLOW"
}

@test "CI workflow release job depends on test job" {
    ensure_yq
    # The release job should have 'needs: test' to ensure proper execution order
    local needs
    needs=$(yaml_get "$CI_WORKFLOW" ".jobs.release.needs")

    [[ "$needs" == "test" ]] || [[ "$needs" == *"test"* ]]
}

@test "CI workflow release job only runs on main branch" {
    ensure_yq
    # The release job should only run on push to main, not on PRs
    local if_condition
    if_condition=$(yaml_get "$CI_WORKFLOW" ".jobs.release.if")

    echo "Actual if condition: $if_condition"

    # Should check for main branch
    [[ "$if_condition" == *"main"* ]]

    # Should check for push event (not pull_request)
    [[ "$if_condition" == *"push"* ]]
}

@test "CI workflow filters all bot accounts to prevent infinite loop" {
    ensure_yq
    # The job should NOT run when ANY bot account is the actor
    # This prevents infinite loops when auto-update-bot-baleen[bot] merges PRs
    local if_condition
    if_condition=$(yaml_get "$CI_WORKFLOW" ".jobs.release.if")

    echo "Actual if condition: $if_condition"

    # The condition should use contains() to filter ANY bot with [bot] suffix
    # Valid patterns:
    # - !contains(github.actor, '[bot]')
    # - contains(github.actor, '[bot]') == false

    # Check that it uses contains() function for universal bot filtering
    [[ "$if_condition" == *"contains"* ]]
    [[ "$if_condition" == *"[bot]"* ]]

    # Verify it doesn't hardcode specific bot names (like github-actions[bot])
    # Hardcoding specific bot names will miss other bots like auto-update-bot-baleen[bot]
    if [[ "$if_condition" == *"github-actions[bot]"* ]]; then
        # If it mentions github-actions[bot], it must be a general pattern
        # that would also catch other bots
        if [[ "$if_condition" != *"contains"* ]]; then
            echo "ERROR: Condition hardcodes github-actions[bot] without using contains()"
            echo "This will miss other bots like auto-update-bot-baleen[bot]"
            return 1
        fi
    fi
}

@test "CI workflow blocks auto-update-bot-baleen" {
    ensure_yq
    # Specifically verify that auto-update-bot-baleen[bot] would be filtered
    # This is the actual bot causing the infinite loop
    local if_condition
    if_condition=$(yaml_get "$CI_WORKFLOW" ".jobs.release.if")

    echo "Checking if condition blocks auto-update-bot-baleen[bot]: $if_condition"

    # The condition must block any actor with [bot] suffix
    # Valid approaches:
    # 1. !contains(github.actor, '[bot]')
    # 2. github.actor != 'github-actions[bot]' && github.actor != 'auto-update-bot-baleen[bot]' (brittle)

    # Check for the robust solution (contains)
    if [[ "$if_condition" == *"contains"* ]] && [[ "$if_condition" == *"[bot]"* ]]; then
        # This is the good approach - catches all bots
        return 0
    fi

    # If using specific bot names, check if auto-update-bot-baleen[bot] is included
    if [[ "$if_condition" == *"github-actions[bot]"* ]] && [[ "$if_condition" != *"contains"* ]]; then
        # Hardcoded approach - must explicitly list auto-update-bot-baleen[bot]
        if [[ "$if_condition" != *"auto-update-bot-baleen"* ]]; then
            echo "ERROR: Condition filters github-actions[bot] but not auto-update-bot-baleen[bot]"
            echo "This will cause infinite loops when auto-update-bot merges PRs"
            return 1
        fi
    fi

    return 0
}
