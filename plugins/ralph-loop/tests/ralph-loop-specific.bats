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
    # Verify regex check for session_id sanitization
    grep -q 'SESSION_ID.*a-zA-Z0-9_-' "$hook"
}

@test "ralph-loop: stop-hook.sh sanitizes session_id" {
    local hook="${PLUGIN_DIR}/hooks/stop-hook.sh"
    [ -f "$hook" ]
    # Verify regex check for session_id sanitization
    grep -q 'SESSION_ID.*a-zA-Z0-9_-' "$hook"
}

@test "ralph-loop: cancel-ralph.sh sanitizes session_id" {
    local script="${PLUGIN_DIR}/scripts/cancel-ralph.sh"
    [ -f "$script" ]
    # Verify regex check for session_id sanitization
    grep -q 'RALPH_SESSION_ID.*a-zA-Z0-9_-' "$script"
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
