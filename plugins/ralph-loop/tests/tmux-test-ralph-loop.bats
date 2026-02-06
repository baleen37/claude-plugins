#!/usr/bin/env bats
# shellcheck disable=SC1090,SC2314
# tmux integration tests for Ralph Loop plugin
# Tests SessionStart/Stop hooks with real Claude Code sessions

load ../../../packages/bats-helpers/src/bats_helper

PLUGIN_DIR="${PROJECT_ROOT}/plugins/ralph-loop"
SESSION_ENV_FILE="$HOME/.claude/ralph-loop/session-env.sh"

# Helper: Skip test if tmux is not available
skip_if_no_tmux() {
    if ! command -v tmux &>/dev/null; then
        skip "tmux not available - run locally"
    fi
}

# Helper function: wait for output in tmux session
wait_for_output() {
    local session="$1"
    local expected="$2"
    local max_attempts="${3:-40}"  # 20 seconds default
    local attempts=0

    while [ $attempts -lt "$max_attempts" ]; do
        OUTPUT=$(tmux capture-pane -t "$session" -p)
        if echo "$OUTPUT" | grep -q "$expected"; then
            return 0
        fi
        sleep 0.5
        attempts=$((attempts + 1))
    done

    echo "Timeout after $((max_attempts / 2)) seconds waiting for: $expected" >&2
    echo "Last output:" >&2
    tmux capture-pane -t "$session" -p >&2
    return 1
}

setup() {
    # Clean up any existing Ralph Loop state
    rm -rf "$HOME/.claude/ralph-loop"
    mkdir -p "$HOME/.claude/ralph-loop"
}

teardown() {
    # Clean up Ralph Loop state after each test
    rm -rf "$HOME/.claude/ralph-loop"
}

# ============================================================================
# Test: SessionStart hook sets RALPH_SESSION_ID
# ============================================================================

@test "ralph-loop: SessionStart hook creates session-env.sh with RALPH_SESSION_ID" {
    skip_if_no_tmux

    local SESSION_NAME="ralph-test-$$-$RANDOM"
    local TEST_STATE_FILE="$HOME/.claude/ralph-loop/ralph-loop-test-session-123.local.md"

    trap "tmux kill-session -t '$SESSION_NAME' 2>/dev/null || true" EXIT

    # Create a dummy Ralph Loop state file to trigger the hook
    cat > "$TEST_STATE_FILE" <<'EOF'
---
iteration: 0
max_iterations: 10
completion_promise: "DONE"
session_id: test-session-123
---
Test prompt
EOF

    # Start Claude Code in tmux
    tmux new-session -d -s "$SESSION_NAME" -x 100 -y 30
    tmux send-keys -t "$SESSION_NAME" "cd $PROJECT_ROOT" C-m

    # Wait for prompt
    sleep 1

    # Start Claude Code (will trigger SessionStart hook)
    tmux send-keys -t "$SESSION_NAME" "export CLAUDE_ENV_FILE=$SESSION_ENV_FILE && echo 'waiting for hook...'" C-m
    sleep 1

    # Simulate SessionStart hook execution
    export CLAUDE_ENV_FILE="$SESSION_ENV_FILE"
    export SESSION_ID="test-session-123"

    # Manually run the SessionStart hook with JSON input
    echo "{\"session_id\": \"test-session-123\"}" | "$PLUGIN_DIR/hooks/session-start-hook.sh"

    # Verify session-env.sh was created with RALPH_SESSION_ID
    [ -f "$SESSION_ENV_FILE" ]
    grep -q "export RALPH_SESSION_ID=test-session-123" "$SESSION_ENV_FILE"

    # Verify only ONE line (not appended)
    local count
    count=$(grep -c "RALPH_SESSION_ID" "$SESSION_ENV_FILE" || echo "0")
    [ "$count" -eq 1 ]
}

# ============================================================================
# Test: Multiple SessionStart calls overwrite (not append)
# ============================================================================

@test "ralph-loop: SessionStart hook overwrites RALPH_SESSION_ID (bug fix)" {
    skip_if_no_tmux

    local SESSION_NAME="ralph-overwrite-$$-$RANDOM"

    trap "tmux kill-session -t '$SESSION_NAME' 2>/dev/null || true" EXIT

    # Setup: Create initial state file
    local TEST_STATE_FILE1="$HOME/.claude/ralph-loop/ralph-loop-session-alpha.local.md"
    cat > "$TEST_STATE_FILE1" <<'EOF'
---
iteration: 0
max_iterations: 10
completion_promise: "DONE"
session_id: session-alpha
---
Test prompt
EOF

    # First SessionStart hook call
    export CLAUDE_ENV_FILE="$SESSION_ENV_FILE"
    echo "{\"session_id\": \"session-alpha\"}" | "$PLUGIN_DIR/hooks/session-start-hook.sh"

    # Verify first session ID
    grep -q "export RALPH_SESSION_ID=session-alpha" "$SESSION_ENV_FILE"

    # Create second state file (simulating new session)
    local TEST_STATE_FILE2="$HOME/.claude/ralph-loop/ralph-loop-session-beta.local.md"
    cat > "$TEST_STATE_FILE2" <<'EOF'
---
iteration: 0
max_iterations: 10
completion_promise: "DONE"
session_id: session-beta
---
Test prompt
EOF

    # Second SessionStart hook call
    echo "{\"session_id\": \"session-beta\"}" | "$PLUGIN_DIR/hooks/session-start-hook.sh"

    # Verify second session ID OVERWROTE (not appended to) the first
    grep -q "export RALPH_SESSION_ID=session-beta" "$SESSION_ENV_FILE"

    # Verify only ONE line exists (the bug was that it would append)
    local count
    count=$(grep -c "RALPH_SESSION_ID" "$SESSION_ENV_FILE" || echo "0")
    [ "$count" -eq 1 ]

    # Verify old session ID is NOT present
    ! grep -q "session-alpha" "$SESSION_ENV_FILE"
}

# ============================================================================
# Test: cancel-ralph cleans up session-env.sh
# ============================================================================

@test "ralph-loop: cancel-ralph removes RALPH_SESSION_ID from session-env.sh" {
    skip_if_no_tmux

    local SESSION_NAME="ralph-cancel-$$-$RANDOM"
    local TEST_SESSION_ID="cancel-test-session"

    trap "tmux kill-session -t '$SESSION_NAME' 2>/dev/null || true" EXIT

    # Setup: Create state file with matching session_id
    local TEST_STATE_FILE="$HOME/.claude/ralph-loop/ralph-loop-$TEST_SESSION_ID.local.md"
    cat > "$TEST_STATE_FILE" <<EOF
---
iteration: 5
max_iterations: 10
completion_promise: "DONE"
session_id: $TEST_SESSION_ID
---
Test prompt
EOF

    # Create session-env.sh with RALPH_SESSION_ID (same as session_id in state file)
    cat > "$SESSION_ENV_FILE" <<EOF
export RALPH_SESSION_ID=$TEST_SESSION_ID
export OTHER_VAR=should-remain
EOF

    # Run cancel-ralph script (it sources SESSION_ENV_FILE to get RALPH_SESSION_ID)
    "$PLUGIN_DIR/scripts/cancel-ralph.sh"

    # Verify state file was removed
    [ ! -f "$TEST_STATE_FILE" ]

    # Verify RALPH_SESSION_ID was removed from env file
    ! grep -q "RALPH_SESSION_ID" "$SESSION_ENV_FILE"

    # Verify other variables remain
    grep -q "export OTHER_VAR=should-remain" "$SESSION_ENV_FILE"
}

# ============================================================================
# Test: cancel-ralph removes empty session-env.sh
# ============================================================================

@test "ralph-loop: cancel-ralph removes session-env.sh when empty" {
    skip_if_no_tmux

    local SESSION_NAME="ralph-empty-file-$$-$RANDOM"
    local TEST_SESSION_ID="empty-file-test"

    trap "tmux kill-session -t '$SESSION_NAME' 2>/dev/null || true" EXIT

    # Setup: Create state file and session env with ONLY RALPH_SESSION_ID
    local TEST_STATE_FILE="$HOME/.claude/ralph-loop/ralph-loop-$TEST_SESSION_ID.local.md"
    cat > "$TEST_STATE_FILE" <<EOF
---
iteration: 3
max_iterations: 10
completion_promise: "DONE"
session_id: $TEST_SESSION_ID
---
Test prompt
EOF

    # Create session-env.sh with only RALPH_SESSION_ID
    echo "export RALPH_SESSION_ID=$TEST_SESSION_ID" > "$SESSION_ENV_FILE"

    # Run cancel-ralph script (it sources SESSION_ENV_FILE to get RALPH_SESSION_ID)
    "$PLUGIN_DIR/scripts/cancel-ralph.sh"

    # Verify state file was removed
    [ ! -f "$TEST_STATE_FILE" ]

    # Verify env file was ALSO removed (since it's now empty)
    [ ! -f "$SESSION_ENV_FILE" ]
}

# ============================================================================
# Test: SessionStart hook shows loop status when state file exists
# ============================================================================

@test "ralph-loop: SessionStart hook displays loop status when active" {
    skip_if_no_tmux

    local SESSION_NAME="ralph-status-$$-$RANDOM"

    trap "tmux kill-session -t '$SESSION_NAME' 2>/dev/null || true" EXIT

    # Create Ralph Loop state file
    local TEST_STATE_FILE="$HOME/.claude/ralph-loop/ralph-loop-status-test.local.md"
    cat > "$TEST_STATE_FILE" <<'EOF'
---
iteration: 7
max_iterations: 20
completion_promise: "ALL TESTS PASS"
session_id: status-test
---
Make all tests pass
EOF

    # Run SessionStart hook and capture output
    local hook_output
    hook_output=$(echo "{\"session_id\": \"status-test\"}" | "$PLUGIN_DIR/hooks/session-start-hook.sh" 2>&1)

    # Verify status message is shown
    echo "$hook_output" | grep -q "🔄 Ralph Loop Active (iteration 7)"
    echo "$hook_output" | grep -q "Max iterations: 20"
    echo "$hook_output" | grep -q "Completion promise: <promise>ALL TESTS PASS</promise>"
}
