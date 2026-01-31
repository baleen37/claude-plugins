#!/usr/bin/env bats
# claude-isolated-test.bats: Tests for claude-isolated-test skill

load 'helpers/bats_helper.bash'

setup() {
    # Source the helper libraries
    CLAUDE_ISOLATED_TEST_DIR="${BATS_TEST_DIRNAME}/../plugins/me/skills/claude-isolated-test"
    export CLAUDE_ISOLATED_TEST_DIR
}

teardown() {
    # Cleanup any containers created during tests
    docker ps -a --filter "name=claude-test-bats-" --format '{{.Names}}' | xargs -r docker stop -t 0 &>/dev/null || true
    docker ps -a --filter "name=claude-test-bats-" --format '{{.Names}}' | xargs -r docker rm &>/dev/null || true
}

@test "docker-helpers.sh: check_docker_available returns true when Docker is running" {
    if ! command -v docker &>/dev/null || ! docker ps &>/dev/null; then
        skip "Docker not available"
    fi

    source "$CLAUDE_ISOLATED_TEST_DIR/scripts/lib/docker-helpers.sh"

    run check_docker_available
    [ "$status" -eq 0 ]
}

@test "docker-helpers.sh: check_docker_available returns false when Docker is not available" {
    # Mock docker command to return failure
    docker() {
        echo "docker: command not found" >&2
        return 1
    }
    export -f docker

    source "$CLAUDE_ISOLATED_TEST_DIR/scripts/lib/docker-helpers.sh"

    run check_docker_available
    [ "$status" -ne 0 ]

    # Unmock docker function
    unset -f docker
}

@test "docker-helpers.sh: create_container creates a running container" {
    if ! command -v docker &>/dev/null || ! docker ps &>/dev/null; then
        skip "Docker not available"
    fi

    source "$CLAUDE_ISOLATED_TEST_DIR/scripts/lib/docker-helpers.sh"

    local container_name="claude-test-bats-$$-$RANDOM"
    local test_token="test-token-12345"

    # Create container (use a simple image for testing)
    create_container "$container_name" "ubuntu:24.04" "$test_token" "/tmp"

    # Verify container exists and is running
    run container_exists "$container_name"
    [ "$status" -eq 0 ]

    run container_running "$container_name"
    [ "$status" -eq 0 ]

    # Cleanup
    cleanup_container "$container_name"

    # Verify cleanup
    run container_exists "$container_name"
    [ "$status" -ne 0 ]
}

@test "test-helpers.sh: verify_contains checks all expected strings" {
    source "$CLAUDE_ISOLATED_TEST_DIR/scripts/lib/test-helpers.sh"

    local output="This is a test output with multiple lines"

    run verify_contains "$output" "test output" "multiple"
    [ "$status" -eq 0 ]

    run verify_contains "$output" "test output" "NOTPRESENT"
    [ "$status" -ne 0 ]
}

@test "run-docker-test.sh: script exists and is executable" {
    local script="$CLAUDE_ISOLATED_TEST_DIR/scripts/run-docker-test.sh"

    [ -f "$script" ]
    [ -x "$script" ]
}

@test "run-docker-test.sh: shows usage when called without arguments" {
    if ! command -v docker &>/dev/null; then
        skip "Docker not available"
    fi

    local script="$CLAUDE_ISOLATED_TEST_DIR/scripts/run-docker-test.sh"

    run "$script"
    [ "$status" -ne 0 ]
    [[ "$output" == *"Usage:"* ]]
}

@test "run-docker-test.sh: skips when test file not found" {
    if ! command -v docker &>/dev/null; then
        skip "Docker not available"
    fi

    local script="$CLAUDE_ISOLATED_TEST_DIR/scripts/run-docker-test.sh"

    run "$script" "/nonexistent/test.yaml"
    [ "$status" -ne 0 ]
    [[ "$output" == *"not found"* ]]
}
