#!/usr/bin/env bats
# test-helpers.bats: Tests for test-helpers.sh library

load /Users/baleen/dev/claude-plugins/tests/helpers/bats_helper.bash

# Path to test-helpers.sh
TEST_HELPERS_DIR="$(cd "${BATS_TEST_DIRNAME}/../scripts/lib" && pwd)"

# Source test-helpers.sh before each test
setup() {
    source "${TEST_HELPERS_DIR}/test-helpers.sh"
    # Reset global variables
    TEST_NAME=""
    TEST_TARGET_TYPE=""
    TEST_TARGET_NAME=""
    TEST_PROMPT=""
    TEST_TIMEOUT=60
    TEST_EXPECTED_CONTAINS=()
    TEST_EXPECTED_NOT_CONTAINS=()
}

# Absolute path to test YAML files
TEST_YAML_DIR="$(cd "${BATS_TEST_DIRNAME}" && pwd)"

@test "load_test_definition parses name correctly" {
    # Arrange
    local test_file="${TEST_YAML_DIR}/example-skill-test.yaml"

    # Act
    load_test_definition "$test_file"

    # Assert
    [ "$TEST_NAME" = "Research SKILL Activation Test" ]
}

@test "load_test_definition parses target type and name correctly" {
    # Arrange
    local test_file="${TEST_YAML_DIR}/example-skill-test.yaml"

    # Act
    load_test_definition "$test_file"

    # Assert
    [ "$TEST_TARGET_TYPE" = "skill" ]
    [ "$TEST_TARGET_NAME" = "research" ]
}

@test "load_test_definition parses prompt correctly" {
    # Arrange
    local test_file="${TEST_YAML_DIR}/example-skill-test.yaml"

    # Act
    load_test_definition "$test_file"

    # Assert
    [[ "$TEST_PROMPT" == *"TDD best practices"* ]]
}

@test "load_test_definition parses timeout correctly" {
    # Arrange
    local test_file="${TEST_YAML_DIR}/example-skill-test.yaml"

    # Act
    load_test_definition "$test_file"

    # Assert
    [ "$TEST_TIMEOUT" = "60" ]
}

@test "load_test_definition parses contains array without leading whitespace and dashes" {
    # Arrange
    local test_file="${TEST_YAML_DIR}/example-skill-test.yaml"

    # Act
    load_test_definition "$test_file"

    # Assert - should have clean values, not "    - evidence-based"
    [ "${#TEST_EXPECTED_CONTAINS[@]}" -eq 2 ]
    [[ "${TEST_EXPECTED_CONTAINS[0]}" == *"evidence-based"* ]] || [[ "${TEST_EXPECTED_CONTAINS[0]}" == "evidence-based" ]]
    [[ "${TEST_EXPECTED_CONTAINS[1]}" == *"systematic"* ]] || [[ "${TEST_EXPECTED_CONTAINS[1]}" == "systematic" ]]
}

@test "load_test_definition does NOT include not_contains items in TEST_EXPECTED_CONTAINS" {
    # Arrange
    local test_file="${TEST_YAML_DIR}/example-skill-test.yaml"

    # Act
    load_test_definition "$test_file"

    # Assert - should NOT contain "error" or "failed" (those are in not_contains)
    for item in "${TEST_EXPECTED_CONTAINS[@]}"; do
        [ "$item" != "error" ]
        [ "$item" != "failed" ]
    done
}

@test "verify_contains returns success when all strings found" {
    # Arrange
    local output="This is evidence-based and systematic approach"

    # Act
    run verify_contains "$output" "evidence-based" "systematic"

    # Assert
    [ "$status" -eq 0 ]
}

@test "verify_contains returns failure when string not found" {
    # Arrange
    local output="This is missing something"

    # Act
    run verify_contains "$output" "evidence-based"

    # Assert
    [ "$status" -eq 1 ]
}

@test "report_result prints PASS for passing test" {
    # Act
    run report_result "Test Name" "pass" "10"

    # Assert
    [[ "$output" == *"PASS"* ]]
    [[ "$output" == *"Test Name"* ]]
    [[ "$output" == *"10s"* ]]
}

@test "report_result prints FAIL for failing test" {
    # Act
    run report_result "Test Name" "fail" "15"

    # Assert
    [[ "$output" == *"FAIL"* ]]
    [[ "$output" == *"Test Name"* ]]
    [[ "$output" == *"15s"* ]]
}

@test "load_test_definition parses not_contains array correctly" {
    # Arrange
    local test_file="${TEST_YAML_DIR}/example-skill-test.yaml"

    # Act
    load_test_definition "$test_file"

    # Assert - should have 2 not_contains items
    [ "${#TEST_EXPECTED_NOT_CONTAINS[@]}" -eq 2 ]
    [ "${TEST_EXPECTED_NOT_CONTAINS[0]}" = "error" ]
    [ "${TEST_EXPECTED_NOT_CONTAINS[1]}" = "failed" ]
}

@test "verify_not_contains returns success when strings not found" {
    # Arrange
    local output="This is clean output"

    # Act
    run verify_not_contains "$output" "error" "failed"

    # Assert
    [ "$status" -eq 0 ]
}

@test "verify_not_contains returns failure when unwanted string found" {
    # Arrange
    local output="This has an error in it"

    # Act
    run verify_not_contains "$output" "error" "failed"

    # Assert
    [ "$status" -eq 1 ]
}
