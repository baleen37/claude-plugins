#!/usr/bin/env bash
# test-helpers.sh: Test execution and verification functions
set -euo pipefail

# Global variables for test data
TEST_NAME=""
TEST_TARGET_TYPE=""
TEST_TARGET_NAME=""
TEST_PROMPT=""
TEST_TIMEOUT=60
TEST_EXPECTED_CONTAINS=()

# Load YAML test definition
load_test_definition() {
    local test_file="$1"

    if [ ! -f "$test_file" ]; then
        echo "Error: Test file not found: $test_file" >&2
        return 1
    fi

    # Parse YAML using grep/sed
    TEST_NAME=$(grep '^name:' "$test_file" | sed 's/name: *//; s/"//g; s/\r//')
    TEST_TARGET_TYPE=$(grep -A2 '^test_target:' "$test_file" | grep 'type:' | sed 's/.*type: *//; s/\r//')
    TEST_TARGET_NAME=$(grep -A2 '^test_target:' "$test_file" | grep 'name:' | sed 's/.*name: *//; s/\r//')
    # shellcheck disable=SC2034  # Used by run-docker-test.sh
    TEST_PROMPT=$(grep -A1 '^input:' "$test_file" | grep 'prompt:' | sed 's/.*prompt: *//; s/"//g; s/\r//')
    TEST_TIMEOUT=$(grep '^timeout:' "$test_file" | awk '{print $2}')
    TEST_TIMEOUT=${TEST_TIMEOUT:-60}

    # Parse expected_output.contains (multi-line)
    local in_contains=0
    while IFS= read -r line; do
        if echo "$line" | grep -q 'expected_output:'; then
            in_contains=1
            continue
        fi
        if [ "$in_contains" = "1" ]; then
            if echo "$line" | grep -q 'contains:'; then
                continue
            fi
            if echo "$line" | grep -qE '^\s+-\s+(.*)'; then
                local value
                value=$(echo "$line" | sed 's/^\s*-\s*//; s/"//g; s/\r//')
                if [ -n "$value" ]; then
                    TEST_EXPECTED_CONTAINS+=("$value")
                fi
            elif echo "$line" | grep -qE '^\s+[a-z_]+:'; then
                # New key, stop parsing contains
                break
            fi
        fi
    done < "$test_file"

    echo "Loaded test: $TEST_NAME" >&2
    echo "  Target: $TEST_TARGET_TYPE/$TEST_TARGET_NAME" >&2
    echo "  Timeout: ${TEST_TIMEOUT}s" >&2
}

# Verify output contains expected strings
verify_contains() {
    local output="$1"
    shift
    local expected_strings=("$@")
    local failed=0

    for str in "${expected_strings[@]}"; do
        if ! echo "$output" | grep -qF "$str"; then
            echo "  Expected to contain: $str" >&2
            failed=1
        else
            echo "  Found: $str" >&2
        fi
    done

    return $failed
}

# Verify file exists in container
verify_file_exists() {
    local container_name="$1"
    local file_path="$2"

    docker exec "$container_name" test -f "$file_path"
}

# Verify file contains content
verify_file_contains() {
    local container_name="$1"
    local file_path="$2"
    local expected_content="$3"

    local output
    output=$(docker exec "$container_name" cat "$file_path" 2>/dev/null || echo "")
    echo "$output" | grep -qF "$expected_content"
}

# Measure execution time
measure_time() {
    local start_time
    start_time=$(date +%s)
    "$@"
    local end_time
    end_time=$(date +%s)
    echo $((end_time - start_time))
}

# Report test result
report_result() {
    local test_name="$1"
    local status="$2"
    local duration="${3:-0}"

    if [ "$status" = "pass" ]; then
        echo "PASS: $test_name (${duration}s)"
    else
        echo "FAIL: $test_name (${duration}s)"
    fi
}

# Skip test with message
skip() {
    local message="$1"
    echo "SKIP: $message" >&2
    exit 0
}
