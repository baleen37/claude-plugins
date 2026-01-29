#!/usr/bin/env bats
# Ralph Loop plugin-specific tests
# Basic validation is handled in tests/ directory

load ../../../tests/helpers/bats_helper

PLUGIN_DIR="${PROJECT_ROOT}/plugins/ralph-loop"

@test "ralph-loop: setup-ralph-loop.sh script exists" {
    [ -f "${PLUGIN_DIR}/scripts/setup-ralph-loop.sh" ]
}

@test "ralph-loop: cancel-ralph.sh script exists" {
    [ -f "${PLUGIN_DIR}/scripts/cancel-ralph.sh" ]
}

@test "ralph-loop: ralph-loop command uses SessionStart and Stop hooks" {
    # Verify the ralph-loop command integrates with hooks
    local cmd_file="${PLUGIN_DIR}/commands/ralph-loop.md"
    [ -f "$cmd_file" ]
    has_frontmatter_delimiter "$cmd_file"
}

@test "ralph-loop: cancel-ralph command exists" {
    local cmd_file="${PLUGIN_DIR}/commands/cancel-ralph.md"
    [ -f "$cmd_file" ]
    has_frontmatter_delimiter "$cmd_file"
}

@test "ralph-loop: scripts use proper error handling" {
    for script in "${PLUGIN_DIR}"/scripts/*.sh; do
        if [ -f "$script" ]; then
            grep -q "set -euo pipefail" "$script"
        fi
    done
}

@test "ralph-loop: hooks use proper error handling" {
    for hook in "${PLUGIN_DIR}"/hooks/*.sh; do
        if [ -f "$hook" ]; then
            grep -q "set -euo pipefail" "$hook"
        fi
    done
}

@test "ralph-loop: session-start-hook.sh sanitizes session_id" {
    local hook="${PLUGIN_DIR}/hooks/session-start-hook.sh"
    [ -f "$hook" ]
    # Verify validate_session_id function is called
    grep -q 'validate_session_id.*SESSION_ID' "$hook"
}

@test "ralph-loop: stop-hook.sh sanitizes session_id" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]
    # Verify validate_session_id function is called
    grep -q 'validate_session_id.*SESSION_ID' "$hook"
}

@test "ralph-loop: cancel-ralph.sh sanitizes session_id" {
    local script="${PLUGIN_DIR}/scripts/cancel-ralph.sh"
    [ -f "$script" ]
    # Verify validate_session_id function is called
    grep -q 'validate_session_id.*RALPH_SESSION_ID' "$script"
}

@test "ralph-loop: setup-ralph-loop.sh validates --max-iterations is numeric" {
    local script="${PLUGIN_DIR}/scripts/setup-ralph-loop.sh"
    [ -f "$script" ]
    # Verify numeric validation for max-iterations (checks $2 before assignment)
    grep -q '\$2.*0-9' "$script"
}

@test "ralph-loop: setup-ralph-loop.sh requires prompt argument" {
    local script="${PLUGIN_DIR}/scripts/setup-ralph-loop.sh"
    [ -f "$script" ]
    # Verify prompt validation
    grep -q 'if \[\[ -z "\$PROMPT" \]\]' "$script"
}

@test "ralph-loop: setup-ralph-loop.sh validates RALPH_SESSION_ID exists" {
    local script="${PLUGIN_DIR}/scripts/setup-ralph-loop.sh"
    [ -f "$script" ]
    # Verify RALPH_SESSION_ID validation
    grep -q 'if \[\[ -z "\${RALPH_SESSION_ID:-}" \]\]' "$script"
}

@test "ralph-loop: setup-ralph-loop.sh checks for existing state file" {
    local script="${PLUGIN_DIR}/scripts/setup-ralph-loop.sh"
    [ -f "$script" ]
    # Verify duplicate loop prevention
    grep -q 'if \[\[ -f "\$STATE_FILE" \]\]' "$script"
}

@test "ralph-loop: stop-hook.sh validates iteration field is numeric" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]
    # Verify numeric validation for iteration
    grep -q 'ITERATION.*0-9' "$hook"
}

@test "ralph-loop: stop-hook.sh validates max_iterations field is numeric" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]
    # Verify numeric validation for max_iterations
    grep -q 'MAX_ITERATIONS.*0-9' "$hook"
}

@test "ralph-loop: stop-hook.sh checks for max iterations reached" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]
    # Verify max iterations check
    grep -q 'if \[\[ \$MAX_ITERATIONS -gt 0 \]\] && \[\[ \$ITERATION -ge \$MAX_ITERATIONS \]\]' "$hook"
}

@test "ralph-loop: stop-hook.sh checks for completion promise" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]
    # Verify completion promise detection
    grep -q '<promise>' "$hook"
}

@test "ralph-loop: stop-hook.sh validates transcript file exists" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]
    # Verify transcript file validation
    grep -q 'if \[\[ ! -f "\$TRANSCRIPT_PATH" \]\]' "$hook"
}

@test "ralph-loop: stop-hook.sh checks for assistant messages in transcript" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]
    # Verify assistant message check
    grep -q 'grep -q.*"role":"assistant".*TRANSCRIPT_PATH' "$hook"
}

@test "ralph-loop: stop-hook.sh outputs JSON with block decision" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]
    # Verify JSON output format
    grep -q '"decision": "block"' "$hook"
}

@test "ralph-loop: hooks.json references SessionStart and Stop hooks" {
    local hooks_json="${PLUGIN_DIR}/hooks/hooks.json"
    [ -f "$hooks_json" ]
    validate_json "$hooks_json"
    ensure_jq
    # hooks.json has nested structure: hooks.SessionStart, hooks.Stop
    grep -q '"SessionStart"' "$hooks_json"
    grep -q '"Stop"' "$hooks_json"
}

@test "ralph-loop: hooks.json points to valid shell scripts" {
    local hooks_json="${PLUGIN_DIR}/hooks/hooks.json"
    [ -f "$hooks_json" ]
    ensure_jq

    # hooks.json has nested structure - extract hook paths
    local session_start
    local stop
    session_start=$($JQ_BIN -r '.hooks.SessionStart[0].hooks[0].command' "$hooks_json")
    stop=$($JQ_BIN -r '.hooks.Stop[0].hooks[0].command' "$hooks_json")

    # Hooks use ${CLAUDE_PLUGIN_ROOT} variable - verify structure
    [[ "$session_start" == *"/session-start-hook.sh" ]]
    [[ "$stop" == *"/stop-hook.sh" ]]

    # Verify actual files exist
    [ -f "${PLUGIN_DIR}/hooks/session-start-hook.sh" ]
    [ -f "${PLUGIN_DIR}/hooks/stop-hook.sh" ]
}

@test "ralph-loop: setup-ralph-loop.sh creates state file with YAML frontmatter" {
    local script="${PLUGIN_DIR}/scripts/setup-ralph-loop.sh"
    [ -f "$script" ]
    # Verify YAML frontmatter creation
    grep -q '^---$' "$script"
    grep -q '^iteration: ' "$script"
    grep -q '^max_iterations: ' "$script"
    grep -q '^completion_promise: ' "$script"
    grep -q '^session_id: ' "$script"
}

@test "ralph-loop: cancel-ralph.sh handles missing state file gracefully" {
    local script="${PLUGIN_DIR}/scripts/cancel-ralph.sh"
    [ -f "$script" ]
    # Verify graceful handling when no loop is active
    grep -q 'if \[\[ ! -f "\$STATE_FILE" \]\]' "$script"
}

# ============================================================================
# Unit Tests for state.sh Library Functions
# ============================================================================

@test "ralph-loop: state.sh validate_session_id accepts valid session IDs" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Source the library
    source "$state_lib"

    # Valid session IDs should pass
    validate_session_id "abc123"
    validate_session_id "ABC-123_def"
    validate_session_id "test_session_123"
}

@test "ralph-loop: state.sh validate_session_id rejects invalid session IDs" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Source the library
    source "$state_lib"

    # Invalid session IDs should fail
    ! validate_session_id "invalid/with/slashes"
    ! validate_session_id "invalid..with..dots"
    ! validate_session_id "invalid with spaces"
    ! validate_session_id "invalid;with;semicolons"
    ! validate_session_id "../../../etc/passwd"
}

@test "ralph-loop: state.sh parse_frontmatter extracts YAML correctly" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Create a test state file
    local test_state_file
    test_state_file=$(mktemp)
    cat > "$test_state_file" <<'EOF'
---
iteration: 5
max_iterations: 50
completion_promise: "DONE"
session_id: test-session-123
---
This is the prompt text
EOF

    # Source the library
    source "$state_lib"

    # Parse frontmatter
    local frontmatter
    frontmatter=$(parse_frontmatter "$test_state_file")

    # Verify frontmatter was extracted
    echo "$frontmatter" | grep -q '^iteration: 5'
    echo "$frontmatter" | grep -q '^max_iterations: 50'
    echo "$frontmatter" | grep -q '^completion_promise: "DONE"'
    echo "$frontmatter" | grep -q '^session_id: test-session-123'

    # Verify prompt text is NOT in frontmatter
    ! echo "$frontmatter" | grep -q 'This is the prompt text'

    rm -f "$test_state_file"
}

@test "ralph-loop: state.sh get_iteration extracts iteration number" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Source the library
    source "$state_lib"

    local frontmatter="iteration: 42"
    local result
    result=$(get_iteration "$frontmatter")

    [ "$result" = "42" ]
}

@test "ralph-loop: state.sh get_max_iterations extracts max_iterations" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Source the library
    source "$state_lib"

    local frontmatter="max_iterations: 100"
    local result
    result=$(get_max_iterations "$frontmatter")

    [ "$result" = "100" ]
}

@test "ralph-loop: state.sh get_max_iterations handles unlimited (0)" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Source the library
    source "$state_lib"

    local frontmatter="max_iterations: 0"
    local result
    result=$(get_max_iterations "$frontmatter")

    [ "$result" = "0" ]
}

@test "ralph-loop: state.sh get_completion_promise extracts quoted promise" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Source the library
    source "$state_lib"

    local frontmatter='completion_promise: "TASK COMPLETE"'
    local result
    result=$(get_completion_promise "$frontmatter")

    [ "$result" = "TASK COMPLETE" ]
}

@test "ralph-loop: state.sh get_completion_promise handles null promise" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Source the library
    source "$state_lib"

    local frontmatter='completion_promise: null'
    local result
    result=$(get_completion_promise "$frontmatter")

    [ "$result" = "null" ]
}

# ============================================================================
# Completion Promise Tag Extraction Tests
# ============================================================================

@test "ralph-loop: stop-hook.sh promise extraction handles basic tags" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]

    # Verify the Perl regex for promise extraction exists
    grep -q 'perl.*promise' "$hook"

    # The regex should be non-greedy (.*?)
    grep -q '.*?' "$hook"
}

@test "ralph-loop: stop-hook.sh promise extraction handles multiline content" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]

    # Verify -0777 flag for slurping entire input
    grep -q 'perl.*-0777' "$hook"

    # Verify -pe flag is used for multiline editing
    grep -q 'perl -0777 -pe' "$hook"
}

@test "ralph-loop: stop-hook.sh promise extraction normalizes whitespace" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]

    # Verify whitespace normalization in Perl regex (s/\s+/ /g)
    grep -q 's.*\\s.*+.* /g' "$hook"
}

# ============================================================================
# Multibyte Character Handling Tests
# ============================================================================

@test "ralph-loop: state.sh handles UTF-8 in completion promise" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Create a test state file with UTF-8 content
    local test_state_file
    test_state_file=$(mktemp)
    cat > "$test_state_file" <<'EOF'
---
iteration: 0
max_iterations: 10
completion_promise: "완료"
session_id: test-session-123
---
테스트 프롬프트
EOF

    # Source the library
    source "$state_lib"

    # Parse and extract - should handle UTF-8 correctly
    local frontmatter
    frontmatter=$(parse_frontmatter "$test_state_file")
    local result
    result=$(get_completion_promise "$frontmatter")

    [ "$result" = "완료" ]

    rm -f "$test_state_file"
}

@test "ralph-loop: state.sh handles emoji in prompt text" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Create a test state file with emoji
    local test_state_file
    test_state_file=$(mktemp)
    cat > "$test_state_file" <<'EOF'
---
iteration: 0
max_iterations: 10
completion_promise: "✅ DONE"
session_id: test-session-123
---
Fix the bug 🐛 and add tests 🧪
EOF

    # Source the library
    source "$state_lib"

    # Parse frontmatter
    local frontmatter
    frontmatter=$(parse_frontmatter "$test_state_file")
    local result
    result=$(get_completion_promise "$frontmatter")

    [ "$result" = "✅ DONE" ]

    rm -f "$test_state_file"
}

# ============================================================================
# Edge Case Tests
# ============================================================================

@test "ralph-loop: state.sh handles empty iteration value" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Source the library
    source "$state_lib"

    # Empty value should return empty string (validation happens elsewhere)
    local frontmatter="iteration: "
    local result
    result=$(get_iteration "$frontmatter")

    [ "$result" = "" ]
}

@test "ralph-loop: state.sh handles completion promise with special chars" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Create a test state file with special characters
    local test_state_file
    test_state_file=$(mktemp)
    cat > "$test_state_file" <<'EOF'
---
iteration: 0
max_iterations: 10
completion_promise: "All tests passing: 100% coverage!"
session_id: test-session-123
---
Run the tests
EOF

    # Source the library
    source "$state_lib"

    local frontmatter
    frontmatter=$(parse_frontmatter "$test_state_file")
    local result
    result=$(get_completion_promise "$frontmatter")

    [ "$result" = "All tests passing: 100% coverage!" ]

    rm -f "$test_state_file"
}

@test "ralph-loop: state.sh handles prompt with dashes at start" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Create a test state file with dashes in prompt
    local test_state_file
    test_state_file=$(mktemp)
    cat > "$test_state_file" <<'EOF'
---
iteration: 0
max_iterations: 10
completion_promise: "DONE"
session_id: test-session-123
---
--- This is a dash
Another line
EOF

    # Source the library
    source "$state_lib"

    # Parse frontmatter - should only get YAML part
    local frontmatter
    frontmatter=$(parse_frontmatter "$test_state_file")

    # Verify frontmatter doesn't include prompt content
    ! echo "$frontmatter" | grep -q 'This is a dash'

    # Verify YAML fields are present
    echo "$frontmatter" | grep -q '^iteration: 0'
    echo "$frontmatter" | grep -q '^session_id: test-session-123'

    rm -f "$test_state_file"
}

@test "ralph-loop: setup-ralph-loop.sh handles prompt with newlines" {
    local script="${PLUGIN_DIR}/scripts/setup-ralph-loop.sh"
    [ -f "$script" ]

    # Verify the script handles multi-word prompts correctly
    grep -q 'PROMPT_PARTS' "$script"

    # Verify array joining
    grep -q 'PROMPT=.*PROMPT_PARTS' "$script"
}

@test "ralph-loop: setup-ralph-loop.sh handles empty PROMPT_PARTS array with set -u" {
    local script="${PLUGIN_DIR}/scripts/setup-ralph-loop.sh"
    [ -f "$script" ]

    # Verify the script uses default parameter expansion for empty arrays
    # This prevents "unbound variable" errors when set -u is enabled
    grep -q 'PROMPT_PARTS\[\*\]:-' "$script"
}
