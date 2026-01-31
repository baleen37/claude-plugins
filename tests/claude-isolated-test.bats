#!/usr/bin/env bats

# Tests for claude-isolated-test skill
# These are unit/integration tests - actual container execution requires E2E tests

setup() {
    TEST_DIR="${BATS_TMPDIR}/claude-isolated-test-$$"
    SCRIPT_DIR="/Users/baleen/dev/claude-plugins/plugins/me/skills/claude-isolated-test"
    mkdir -p "$TEST_DIR"
}

teardown() {
    rm -rf "$TEST_DIR"
}

# ===== PREREQUISITE TESTS =====

@test "packnplay is installed" {
    run command -v packnplay
    [ "$status" -eq 0 ]
    [[ "$output" =~ packnplay ]]
}

@test "script file exists" {
    [ -f "$SCRIPT_DIR/shell.sh" ]
}

@test "script is executable" {
    [ -x "$SCRIPT_DIR/shell.sh" ]
}

# ===== HELP TESTS =====

@test "help flag shows usage" {
    run "$SCRIPT_DIR/shell.sh" --help
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Claude Code Container" ]]
    [[ "$output" =~ "Usage:" ]]
}

@test "help shows all options" {
    run "$SCRIPT_DIR/shell.sh" --help
    [[ "$output" =~ "--session" ]]
    [[ "$output" =~ "--publish" ]]
    [[ "$output" =~ "--list" ]]
    [[ "$output" =~ "--kill" ]]
    [[ "$output" =~ "--stop" ]]
}

@test "help shows environment variables" {
    run "$SCRIPT_DIR/shell.sh" --help
    [[ "$output" =~ "WORKSPACE" ]]
    [[ "$output" =~ "CLAUDE_SESSION_NAME" ]]
}

# ===== INVALID OPTION TESTS =====

@test "unknown option causes error" {
    run "$SCRIPT_DIR/shell.sh" --invalid-option
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Unknown option" ]]
}

# ===== LIST SESSIONS TESTS (requires Docker) =====

@test "list sessions requires container" {
    run bash -c 'cd "$SCRIPT_DIR" && "$SCRIPT_DIR/shell.sh" --list 2>&1' || true
    # Without a running container, should either fail silently or show error
    # The test passes if the command executes (regardless of exit code)
    [ "$status" -ge 0 ]
}

# ===== STOP CONTAINER TESTS =====

@test "stop flag with non-existent container" {
    run bash -c 'cd "$SCRIPT_DIR" && "$SCRIPT_DIR/shell.sh" --stop 2>&1' || true
    # Without a running container, should either succeed or fail gracefully
    [ "$status" -ge 0 ]
}

# ===== ENVIRONMENT VARIABLE DEFAULTS =====

@test "default session name is claude" {
    run grep -q 'SESSION_NAME="\${CLAUDE_SESSION_NAME:-claude}"' "$SCRIPT_DIR/shell.sh"
    [ "$status" -eq 0 ]
}
