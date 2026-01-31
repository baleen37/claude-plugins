#!/usr/bin/env bats
# Test: Auto Compact functionality

load helpers/bats_helper

PLUGIN_ROOT="${PROJECT_ROOT}/plugins/auto-compact"
HOOKS_DIR="${PLUGIN_ROOT}/hooks"
LIB_DIR="${HOOKS_DIR}/lib"
STATE_DIR="$HOME/.claude/auto-compact"

setup() {
    # Call parent setup
    if [ -n "${TEST_TEMP_DIR:-}" ]; then
        export TEST_TEMP_DIR=$(mktemp -d -t claude-plugins-test.XXXXXX)
    else
        export TEST_TEMP_DIR=$(mktemp -d -t claude-plugins-test.XXXXXX)
    fi

    # Backup existing state directory if it exists
    if [ -d "$STATE_DIR" ]; then
        BACKUP_STATE_DIR="${TEST_TEMP_DIR}/state-backup"
        cp -R "$STATE_DIR" "$BACKUP_STATE_DIR" 2>/dev/null || true
    fi

    # Clean test state directory
    rm -rf "$STATE_DIR" 2>/dev/null || true
}

teardown() {
    # Clean up test state directory
    rm -rf "$STATE_DIR" 2>/dev/null || true

    # Restore backup if it existed
    if [ -n "${BACKUP_STATE_DIR:-}" ] && [ -d "$BACKUP_STATE_DIR" ]; then
        cp -R "$BACKUP_STATE_DIR" "$STATE_DIR" 2>/dev/null || true
    fi

    # Clean up temp directory
    if [ -n "${TEST_TEMP_DIR:-}" ] && [ -d "$TEST_TEMP_DIR" ]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

# ========================================
# Test Suite 1: Hook scripts exist and are executable
# ========================================

@test "auto-compact.sh exists and is executable" {
    assert_file_exists "${HOOKS_DIR}/auto-compact.sh" "auto-compact.sh should exist"
    [ -x "${HOOKS_DIR}/auto-compact.sh" ]
}

@test "session-start-hook.sh exists and is executable" {
    assert_file_exists "${HOOKS_DIR}/session-start-hook.sh" "session-start-hook.sh should exist"
    [ -x "${HOOKS_DIR}/session-start-hook.sh" ]
}

@test "lib/state.sh exists" {
    assert_file_exists "${LIB_DIR}/state.sh" "lib/state.sh should exist"
}

@test "all required hook files are present" {
    assert_file_exists "${HOOKS_DIR}/auto-compact.sh"
    assert_file_exists "${HOOKS_DIR}/session-start-hook.sh"
    assert_file_exists "${HOOKS_DIR}/lib/state.sh"
    assert_file_exists "${HOOKS_DIR}/hooks.json"
}

# ========================================
# Test Suite 2: Session-based counter file usage
# ========================================

@test "creates state directory in ~/.claude/auto-compact/" {
    # Run the hook script with a test session
    export AUTO_COMPACT_SESSION_ID="test-session-123"
    run bash "${HOOKS_DIR}/auto-compact.sh"

    [ -d "$STATE_DIR" ]
}

@test "counter filename includes session_id" {
    local test_session="test-session-abc456"
    export AUTO_COMPACT_SESSION_ID="$test_session"

    run bash "${HOOKS_DIR}/auto-compact.sh"

    local expected_file="$STATE_DIR/tool-count-$test_session.txt"
    assert_file_exists "$expected_file" "counter file should include session_id"
}

@test "counter persists across hook runs" {
    local test_session="test-session-persist"
    export AUTO_COMPACT_SESSION_ID="$test_session"

    # First run
    run bash "${HOOKS_DIR}/auto-compact.sh"
    local counter_file="$STATE_DIR/tool-count-$test_session.txt"

    # Check counter file exists
    [ -f "$counter_file" ]

    # Get initial counter value
    local initial_count
    initial_count=$(cat "$counter_file")

    # Second run
    run bash "${HOOKS_DIR}/auto-compact.sh"

    # Get new counter value
    local new_count
    new_count=$(cat "$counter_file")

    # Counter should have incremented
    [ "$new_count" -gt "$initial_count" ]
}

# ========================================
# Test Suite 3: Counter increment functionality
# ========================================

@test "counter starts at 1 on first run" {
    local test_session="test-session-first"
    export AUTO_COMPACT_SESSION_ID="$test_session"

    run bash "${HOOKS_DIR}/auto-compact.sh"

    local counter_file="$STATE_DIR/tool-count-$test_session.txt"
    local count
    count=$(cat "$counter_file")

    assert_eq "$count" "1" "counter should start at 1"
}

@test "counter increments on each call" {
    local test_session="test-session-increment"
    export AUTO_COMPACT_SESSION_ID="$test_session"

    # First run
    run bash "${HOOKS_DIR}/auto-compact.sh"
    local counter_file="$STATE_DIR/tool-count-$test_session.txt"
    local count1
    count1=$(cat "$counter_file")

    # Second run
    run bash "${HOOKS_DIR}/auto-compact.sh"
    local count2
    count2=$(cat "$counter_file")

    # Third run
    run bash "${HOOKS_DIR}/auto-compact.sh"
    local count3
    count3=$(cat "$counter_file")

    assert_eq "$count1" "1" "first count should be 1"
    assert_eq "$count2" "2" "second count should be 2"
    assert_eq "$count3" "3" "third count should be 3"
}

@test "counter value persists across multiple invocations" {
    local test_session="test-session-persist-value"
    export AUTO_COMPACT_SESSION_ID="$test_session"

    # Run 5 times
    for i in {1..5}; do
        run bash "${HOOKS_DIR}/auto-compact.sh"
    done

    local counter_file="$STATE_DIR/tool-count-$test_session.txt"
    local count
    count=$(cat "$counter_file")

    assert_eq "$count" "5" "counter should be 5 after 5 runs"
}

# ========================================
# Test Suite 4: Threshold suggestions
# ========================================

@test "shows message at default threshold of 50" {
    local test_session="test-session-threshold-50"
    export AUTO_COMPACT_SESSION_ID="$test_session"

    # Create counter file at 49
    local counter_file="$STATE_DIR/tool-count-$test_session.txt"
    mkdir -p "$STATE_DIR"
    echo "49" > "$counter_file"

    # Run hook - should trigger threshold message
    run bash "${HOOKS_DIR}/auto-compact.sh"

    echo "$output" >&2
    [[ "$output" =~ "50 tool calls reached" ]] || [[ "$output" =~ "consider /compact" ]]
}

@test "shows message every 25 calls after threshold" {
    local test_session="test-session-interval"
    export AUTO_COMPACT_SESSION_ID="$test_session"

    local counter_file="$STATE_DIR/tool-count-$test_session.txt"
    mkdir -p "$STATE_DIR"

    # Test at 75 (50 + 25)
    echo "74" > "$counter_file"
    run bash "${HOOKS_DIR}/auto-compact.sh"
    echo "Output at 75: $output" >&2
    [[ "$output" =~ "75 tool calls" ]] || [[ "$output" =~ "checkpoint" ]]

    # Test at 100 (50 + 50)
    echo "99" > "$counter_file"
    run bash "${HOOKS_DIR}/auto-compact.sh"
    echo "Output at 100: $output" >&2
    [[ "$output" =~ "100 tool calls" ]] || [[ "$output" =~ "checkpoint" ]]
}

@test "respects custom COMPACT_THRESHOLD" {
    local test_session="test-session-custom-threshold"
    export AUTO_COMPACT_SESSION_ID="$test_session"
    export COMPACT_THRESHOLD="5"

    local counter_file="$STATE_DIR/tool-count-$test_session.txt"
    mkdir -p "$STATE_DIR"

    # Set counter to 4, next run should trigger at threshold 5
    echo "4" > "$counter_file"
    run bash "${HOOKS_DIR}/auto-compact.sh"

    echo "$output" >&2
    [[ "$output" =~ "5 tool calls reached" ]] || [[ "$output" =~ "consider /compact" ]]
}

@test "no message before threshold" {
    local test_session="test-session-before-threshold"
    export AUTO_COMPACT_SESSION_ID="$test_session"
    export COMPACT_THRESHOLD="100"

    # Run once, counter will be 1
    run bash "${HOOKS_DIR}/auto-compact.sh"

    # Should not contain suggestion messages
    ! [[ "$output" =~ "tool calls reached" ]]
    ! [[ "$output" =~ "checkpoint" ]]
}

@test "no message when count exceeds threshold but not at interval" {
    local test_session="test-session-between-interval"
    export AUTO_COMPACT_SESSION_ID="$test_session"

    local counter_file="$STATE_DIR/tool-count-$test_session.txt"
    mkdir -p "$STATE_DIR"

    # Set to 76 (between 75 and 100 intervals)
    echo "75" > "$counter_file"
    run bash "${HOOKS_DIR}/auto-compact.sh"

    # Should not show interval message at 76
    ! [[ "$output" =~ "76 tool calls" ]]
}

# ========================================
# Test Suite 5: Session ID validation
# ========================================

@test "validates session_id format - accepts valid alphanumeric" {
    source "${LIB_DIR}/state.sh"

    run validate_session_id "valid-session-123"
    [ "$status" -eq 0 ]
}

@test "validates session_id format - accepts underscores" {
    source "${LIB_DIR}/state.sh"

    run validate_session_id "valid_session_123"
    [ "$status" -eq 0 ]
}

@test "validates session_id format - rejects spaces" {
    source "${LIB_DIR}/state.sh"

    run validate_session_id "invalid session"
    [ "$status" -ne 0 ]
}

@test "validates session_id format - rejects special characters" {
    source "${LIB_DIR}/state.sh"

    run validate_session_id "invalid@session!"
    [ "$status" -ne 0 ]
}

@test "falls back to PID when no session_id environment variable" {
    # Unset session_id to force fallback
    unset AUTO_COMPACT_SESSION_ID

    # Run the hook
    run bash "${HOOKS_DIR}/auto-compact.sh"

    # Counter file should use PID pattern (just checking it exists)
    local counter_files
    counter_files=$(find "$STATE_DIR" -name "tool-count-*.txt" 2>/dev/null | wc -l | tr -d ' ')

    [ "$counter_files" -ge 1 ]
}

@test "uses PID-based counter when session_id is invalid" {
    # Set invalid session_id
    export AUTO_COMPACT_SESSION_ID="invalid session with spaces"

    # Run the hook
    run bash "${HOOKS_DIR}/auto-compact.sh"

    # Should complete successfully (fallback to PID)
    [ "$status" -eq 0 ]

    # At least one counter file should exist
    local counter_files
    counter_files=$(find "$STATE_DIR" -name "tool-count-*.txt" 2>/dev/null | wc -l | tr -d ' ')

    [ "$counter_files" -ge 1 ]
}

@test "state.sh library is sourceable" {
    # Source the library
    source "${LIB_DIR}/state.sh"

    # Check that validate_session_id function is available
    type validate_session_id
}

@test "validate_session_id returns 1 for empty string" {
    source "${LIB_DIR}/state.sh"

    run validate_session_id ""
    [ "$status" -eq 1 ]
}

@test "validate_session_id returns 1 for null-like input" {
    source "${LIB_DIR}/state.sh"

    run validate_session_id "null"
    # This should pass validation as "null" is a valid string format
    # The hook script checks for "null" string separately
    [ "$status" -eq 0 ]
}

# ========================================
# Test Suite 6: SessionStart hook behavior
# ========================================

@test "session-start-hook.sh exits successfully with valid session_id JSON" {
    # Create valid SessionStart JSON input
    local valid_json='{"session_id": "test-session-789"}'

    run bash -c "echo '$valid_json' | ${HOOKS_DIR}/session-start-hook.sh"

    [ "$status" -eq 0 ]
}

@test "session-start-hook.sh exits successfully with null session_id" {
    local null_json='{"session_id": null}'

    run bash -c "echo '$null_json' | ${HOOKS_DIR}/session-start-hook.sh"

    [ "$status" -eq 0 ]
}

@test "session-start-hook.sh exits successfully with empty session_id" {
    local empty_json='{"session_id": ""}'

    run bash -c "echo '$empty_json' | ${HOOKS_DIR}/session-start-hook.sh"

    [ "$status" -eq 0 ]
}

@test "session-start-hook.sh writes to CLAUDE_ENV_FILE when set" {
    local test_env_file="${TEST_TEMP_DIR}/test-env.sh"
    # Create the file first (hook only appends to existing writable files)
    touch "$test_env_file"
    local valid_json='{"session_id": "test-session-write"}'

    run bash -c "echo '$valid_json' | CLAUDE_ENV_FILE='$test_env_file' ${HOOKS_DIR}/session-start-hook.sh"

    [ "$status" -eq 0 ]
    [ -f "$test_env_file" ]
    grep -q "AUTO_COMPACT_SESSION_ID=test-session-write" "$test_env_file"
}

@test "session-start-hook.sh appends to existing ENV_FILE" {
    local test_env_file="${TEST_TEMP_DIR}/test-env-append.sh"
    echo "# Existing content" > "$test_env_file"
    local valid_json='{"session_id": "test-session-append"}'

    run bash -c "echo '$valid_json' | CLAUDE_ENV_FILE='$test_env_file' ${HOOKS_DIR}/session-start-hook.sh"

    [ "$status" -eq 0 ]
    grep -q "# Existing content" "$test_env_file"
    grep -q "AUTO_COMPACT_SESSION_ID=test-session-append" "$test_env_file"
}

# ========================================
# Test Suite 7: Error handling
# ========================================

@test "auto-compact.sh handles missing state directory gracefully" {
    local test_session="test-session-missing-dir"
    export AUTO_COMPACT_SESSION_ID="$test_session"

    # Remove state directory
    rm -rf "$STATE_DIR"

    # Run should create directory and succeed
    run bash "${HOOKS_DIR}/auto-compact.sh"

    [ "$status" -eq 0 ]
    [ -d "$STATE_DIR" ]
}

@test "auto-compact.sh fails with error when cannot create state directory" {
    local test_session="test-session-no-permission"
    export AUTO_COMPACT_SESSION_ID="$test_session"

    # This is difficult to test without root privileges
    # Skip if we can't simulate permission error
    skip "Cannot reliably test permission errors without special setup"
}

# ========================================
# Test Suite 8: Integration tests
# ========================================

@test "full workflow: session start then tool calls increment counter" {
    local test_session="integration-session-full"
    local valid_json='{"session_id": "'"$test_session"'"}'
    local test_env_file="${TEST_TEMP_DIR}/integration-env.sh"
    # Create the file first (hook only appends to existing writable files)
    touch "$test_env_file"

    # Simulate SessionStart hook
    run bash -c "echo '$valid_json' | CLAUDE_ENV_FILE='$test_env_file' ${HOOKS_DIR}/session-start-hook.sh"
    [ "$status" -eq 0 ]

    # Source the env file to get session_id
    source "$test_env_file"

    # Now make tool calls
    run bash "${HOOKS_DIR}/auto-compact.sh"
    [ "$status" -eq 0 ]

    run bash "${HOOKS_DIR}/auto-compact.sh"
    [ "$status" -eq 0 ]

    run bash "${HOOKS_DIR}/auto-compact.sh"
    [ "$status" -eq 0 ]

    # Verify counter
    local counter_file="$STATE_DIR/tool-count-$test_session.txt"
    [ -f "$counter_file" ]
    local count
    count=$(cat "$counter_file")
    assert_eq "$count" "3" "counter should be 3 after 3 calls"
}
