#!/usr/bin/env bats
# shellcheck disable=SC1090,SC2314
# Ralph Loop plugin-specific tests
# Basic validation is handled in tests/ directory

load ../../../packages/bats-helpers/src/bats_helper

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

# ============================================================================
# Bug Fix Tests - These tests should FAIL before the fix
# ============================================================================

@test "ralph-loop: hooks.json uses wildcard matcher for SessionStart hook" {
    local hooks_json="${PLUGIN_DIR}/hooks/hooks.json"
    [ -f "$hooks_json" ]
    ensure_jq

    # The matcher should be "*" to run on all sessions
    # The hook script itself checks if state file exists
    local matcher
    matcher=$($JQ_BIN -r '.hooks.SessionStart[0].matcher' "$hooks_json")

    # This test will FAIL until the bug is fixed
    [ "$matcher" = "*" ]
}

@test "ralph-loop: hooks.json uses wildcard matcher for Stop hook" {
    local hooks_json="${PLUGIN_DIR}/hooks/hooks.json"
    [ -f "$hooks_json" ]
    ensure_jq

    # The matcher should be "*" to run on all sessions
    local matcher
    matcher=$($JQ_BIN -r '.hooks.Stop[0].matcher' "$hooks_json")

    # This test will FAIL until the bug is fixed
    [ "$matcher" = "*" ]
}

@test "ralph-loop: session-start-hook.sh reads SESSION_ID from stdin" {
    local hook="${PLUGIN_DIR}/hooks/session-start-hook.sh"
    [ -f "$hook" ]

    # The hook must read from stdin (</dev/stdin or similar)
    # to get the JSON input from Claude Code
    grep -q 'jq.*session_id.*</dev/stdin' "$hook"
}

@test "ralph-loop: session-start-hook.sh writes RALPH_SESSION_ID to ENV_FILE" {
    local hook="${PLUGIN_DIR}/hooks/session-start-hook.sh"
    [ -f "$hook" ]

    # The hook should write RALPH_SESSION_ID to ENV_FILE
    # The bug was that it checked if file exists BEFORE writing, but creates it right before
    # The fix handles both cases: existing file and newly-created file
    grep -q 'echo.*RALPH_SESSION_ID.*>>.*ENV_FILE' "$hook"
    grep -q 'echo.*RALPH_SESSION_ID.*>.*ENV_FILE' "$hook"
}

# ============================================================================
# E2E Integration Tests
# These tests verify the core integration scenarios work correctly
# ============================================================================

@test "ralph-loop: session-start-hook.sh reads session_id from stdin" {
    local hook="${PLUGIN_DIR}/hooks/session-start-hook.sh"
    [ -f "$hook" ]

    # Verify the hook reads from stdin using </dev/stdin or similar
    grep -q 'jq.*session_id.*</dev/stdin' "$hook"
}

@test "ralph-loop: stop-hook.sh reads hook input from stdin" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]

    # Verify the hook reads from stdin
    grep -q 'HOOK_INPUT=.*/dev/stdin' "$hook"
}

@test "ralph-loop: stop-hook.sh outputs block decision JSON when loop active" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]

    # Verify the hook outputs JSON with block decision
    grep -q '"decision": "block"' "$hook"
    grep -q 'jq -n' "$hook"
}

@test "ralph-loop: stop-hook.sh increments iteration counter in state file" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]

    # Verify iteration increment logic
    grep -q 'NEXT_ITERATION=.*ITERATION.*+.*1' "$hook"
    grep -q 'awk.*in_fm.*iteration' "$hook"
}

@test "ralph-loop: stop-hook.sh detects completion promise in assistant output" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]

    # Verify promise detection logic
    grep -q '<promise>' "$hook"
    grep -q 'PROMISE_TEXT=.*perl' "$hook"
}

@test "ralph-loop: stop-hook.sh validates numeric iteration fields" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]

    # Verify numeric validation before arithmetic
    grep -q 'ITERATION.*0-9' "$hook"
    grep -q 'MAX_ITERATIONS.*0-9' "$hook"
}

@test "ralph-loop: stop-hook.sh handles max iterations reached" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]

    # Verify max iteration check
    grep -q 'MAX_ITERATIONS.*-gt.*0.*ITERATION.*-ge.*MAX_ITERATIONS' "$hook"
}

@test "ralph-loop: cancel-ralph.sh removes state file when cancelled" {
    local script="${PLUGIN_DIR}/scripts/cancel-ralph.sh"
    [ -f "$script" ]
    [ -x "$script" ]

    # Verify state file removal logic
    grep -q 'rm.*STATE_FILE' "$script"
}

# ============================================================================
# CRITICAL BUG TESTS - These tests validate that the awk replacement in
# stop-hook.sh ONLY modifies the frontmatter iteration field, NOT iteration:
# text in the prompt content
# ============================================================================

@test "ralph-loop: stop-hook.sh awk replacement does NOT corrupt prompt with iteration: text" {
    # This test validates the fix for the CRITICAL BUG
    # The awk command should only modify the frontmatter iteration field
    # NOT any "iteration:" text that appears in the prompt content

    local state_file
    state_file=$(mktemp)

    # Create a state file with "iteration:" text in the prompt content
    cat > "$state_file" <<'EOF'
---
iteration: 5
max_iterations: 10
completion_promise: "DONE"
session_id: test-session-123
---
The current iteration: 3 shows progress
We need to check the iteration: value carefully
Another line with iteration: at the start
EOF

    # Run the awk command exactly as it appears in stop-hook.sh
    local next_iteration=6
    local temp_file
    temp_file=$(mktemp "${state_file}.tmp.XXXXXX") || exit 1

    # This is the EXACT awk command from stop-hook.sh
    awk 'BEGIN{in_fm=0} /^---$/{if(in_fm){in_fm=0} else{in_fm=1} next} /^iteration: / && in_fm{$0="iteration: '"$next_iteration"'"} 1' "$state_file" > "$temp_file"
    mv "$temp_file" "$state_file"
    rm -f "$temp_file"

    # Verify the frontmatter iteration was updated
    grep '^iteration: 6' "$state_file"

    # CRITICAL: Verify the prompt content was NOT corrupted
    grep 'The current iteration: 3 shows progress' "$state_file"
    grep 'We need to check the iteration: value carefully' "$state_file"
    grep 'Another line with iteration: at the start' "$state_file"

    # Verify only ONE iteration: line was changed (the frontmatter one)
    # Count lines with "iteration: 6" - should be exactly 1
    local count
    count=$(grep -c "^iteration: 6" "$state_file" || true)
    [ "$count" -eq 1 ]

    rm -f "$state_file"
}

@test "ralph-loop: stop-hook.sh awk handles multiple iteration: patterns in prompt" {
    # Test with a more complex prompt containing multiple iteration: references
    local state_file
    state_file=$(mktemp)

    cat > "$state_file" <<'EOF'
---
iteration: 9
max_iterations: 20
completion_promise: null
session_id: test-session-456
---
Review the code:
- iteration: 1 had bugs
- iteration: 2 had more bugs
- Current iteration: 9 needs review
Final check: is iteration: 10 the last one?
EOF

    # Run the awk command
    local next_iteration=10
    local temp_file
    temp_file=$(mktemp "${state_file}.tmp.XXXXXX") || exit 1
    awk 'BEGIN{in_fm=0} /^---$/{if(in_fm){in_fm=0} else{in_fm=1} next} /^iteration: / && in_fm{$0="iteration: '"$next_iteration"'"} 1' "$state_file" > "$temp_file"
    mv "$temp_file" "$state_file"
    rm -f "$temp_file"

    # Frontmatter should be updated
    grep '^iteration: 10' "$state_file"

    # ALL prompt content with iteration: should remain UNCHANGED
    grep 'iteration: 1 had bugs' "$state_file"
    grep 'iteration: 2 had more bugs' "$state_file"
    grep 'Current iteration: 9 needs review' "$state_file"
    grep 'is iteration: 10 the last one?' "$state_file"

    rm -f "$state_file"
}

@test "ralph-loop: stop-hook.sh awk handles iteration: text at start of prompt line" {
    # Test the exact case from the bug report
    local state_file
    state_file=$(mktemp)

    cat > "$state_file" <<'EOF'
---
iteration: 5
max_iterations: 10
completion_promise: "DONE"
session_id: test-session-789
---
iteration: 3 shows the current state
More content here
EOF

    # Run the awk command
    local next_iteration=6
    local temp_file
    temp_file=$(mktemp "${state_file}.tmp.XXXXXX") || exit 1
    awk 'BEGIN{in_fm=0} /^---$/{if(in_fm){in_fm=0} else{in_fm=1} next} /^iteration: / && in_fm{$0="iteration: '"$next_iteration"'"} 1' "$state_file" > "$temp_file"
    mv "$temp_file" "$state_file"
    rm -f "$temp_file"

    # The prompt line should remain unchanged
    grep 'iteration: 3 shows the current state' "$state_file"

    rm -f "$state_file"
}

# ============================================================================
# PROMISE EXTRACTION EDGE CASE TESTS
# These tests validate the Perl regex for extracting promise tags
# ============================================================================

@test "ralph-loop: stop-hook.sh promise extraction handles empty tags" {
    # Test that <promise></promise> returns empty string
    local output="<promise></promise> Some text after"

    local result
    result=$(echo "$output" | perl -0777 -pe 's/.*?<promise>(.*?)<\/promise>.*/$1/s; s/^\s+|\s+$//g; s/\s+/ /g' 2>/dev/null || echo "")

    # Should extract empty string (not the entire text)
    [ "$result" = "" ]
}

@test "ralph-loop: stop-hook.sh promise extraction handles nested-looking tags" {
    # Test with text that looks like nested tags
    local output="Here is <promise>the task is done with <promise>fake</promise> ignored</promise> status"

    local result
    result=$(echo "$output" | perl -0777 -pe 's/.*?<promise>(.*?)<\/promise>.*/$1/s; s/^\s+|\s+$//g; s/\s+/ /g' 2>/dev/null || echo "")

    # Non-greedy .*? should match FIRST closing tag
    # So result should be "the task is done with <promise>fake"
    [ "$result" = "the task is done with <promise>fake" ]
}

@test "ralph-loop: stop-hook.sh promise extraction handles multiline with newlines" {
    # Test multiline promise content
    local output=$'Some text before\n<promise>This is\na\nmultiline\npromise</promise>\nText after'

    local result
    result=$(echo "$output" | perl -0777 -pe 's/.*?<promise>(.*?)<\/promise>.*/$1/s; s/^\s+|\s+$//g; s/\s+/ /g' 2>/dev/null || echo "")

    # Whitespace should be normalized to single spaces
    [ "$result" = "This is a multiline promise" ]
}

@test "ralph-loop: stop-hook.sh promise extraction handles special regex characters" {
    # Test with special regex characters in promise
    local output='<promise>Task [DONE] with (parens) and $dollars</promise>'

    local result
    result=$(echo "$output" | perl -0777 -pe 's/.*?<promise>(.*?)<\/promise>.*/$1/s; s/^\s+|\s+$//g; s/\s+/ /g' 2>/dev/null || echo "")

    [ "$result" = 'Task [DONE] with (parens) and $dollars' ]
}

@test "ralph-loop: stop-hook.sh promise extraction handles unicode whitespace" {
    # Test with various whitespace types (tabs, multiple spaces)
    local output=$'Text before<promise>\t  spaced   \t  out  \t</promise>after'

    local result
    result=$(echo "$output" | perl -0777 -pe 's/.*?<promise>(.*?)<\/promise>.*/$1/s; s/^\s+|\s+$//g; s/\s+/ /g' 2>/dev/null || echo "")

    # Should normalize all whitespace to single spaces
    [ "$result" = "spaced out" ]
}

@test "ralph-loop: stop-hook.sh promise extraction returns original when no tags" {
    # Test when there are no promise tags at all
    local output="Just some text without any promise tags"

    local result
    result=$(echo "$output" | perl -0777 -pe 's/.*?<promise>(.*?)<\/promise>.*/$1/s; s/^\s+|\s+$//g; s/\s+/ /g' 2>/dev/null || echo "")

    # When no tags found, the regex doesn't match and returns original text
    # This test documents the current behavior (not necessarily desired)
    [ "$result" = "Just some text without any promise tags" ]
}

@test "ralph-loop: stop-hook.sh promise extraction handles only opening tag" {
    # Test with only opening tag (malformed)
    local output="Text with <promise>but no closing tag"

    local result
    result=$(echo "$output" | perl -0777 -pe 's/.*?<promise>(.*?)<\/promise>.*/$1/s; s/^\s+|\s+$//g; s/\s+/ /g' 2>/dev/null || echo "")

    # Should return original text when no closing tag
    [ -z "$result" ] || [ "$result" = "$output" ]
}

# ============================================================================
# GREP MULTIPLE MATCHES TESTS
# These tests validate that grep handles duplicate frontmatter fields
# ============================================================================

@test "ralph-loop: state.sh get_iteration handles duplicate iteration fields" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Source the library
    source "$state_lib"

    # Create frontmatter with duplicate iteration fields (shouldn't happen, but test robustness)
    local frontmatter=$'iteration: 5\niteration: 10\niteration: 15'

    local result
    result=$(get_iteration "$frontmatter")

    # Current implementation returns ALL matches
    # This test documents the current behavior
    # The fix should use grep -m 1 to only get the first match
    echo "Result: '$result'"
    # Will FAIL until fixed - should return just "5" not "5\n10\n15"
    [ "$result" = "5" ]
}

@test "ralph-loop: state.sh get_max_iterations handles duplicate max_iterations fields" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Source the library
    source "$state_lib"

    local frontmatter=$'max_iterations: 50\nmax_iterations: 100'

    local result
    result=$(get_max_iterations "$frontmatter")

    # Should return only the first match
    echo "Result: '$result'"
    [ "$result" = "50" ]
}

@test "ralph-loop: state.sh get_completion_promise handles duplicate completion_promise fields" {
    local state_lib="${PLUGIN_DIR}/scripts/lib/state.sh"
    [ -f "$state_lib" ]

    # Source the library
    source "$state_lib"

    local frontmatter=$'completion_promise: "FIRST"\ncompletion_promise: "SECOND"'

    local result
    result=$(get_completion_promise "$frontmatter")

    # Should return only the first match
    echo "Result: '$result'"
    [ "$result" = "FIRST" ]
}
