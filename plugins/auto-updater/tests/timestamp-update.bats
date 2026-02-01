#!/usr/bin/env bats
#
# timestamp-update.bats
# Tests for timestamp update conditional logic
#

# Store original check.sh to restore after tests
ORIGINAL_CHECK=""

setup() {
    export TEST_DIR="${BATS_TEST_DIRNAME}"
    export SCRIPT_DIR="${TEST_DIR}/../scripts"
    export HOOK_DIR="${TEST_DIR}/../hooks"
    export TEMP_DIR="${BATS_TMPDIR}/auto-updater-timestamp-test-$$"

    mkdir -p "$TEMP_DIR"
    export HOME="$TEMP_DIR"
    export CONFIG_DIR="$HOME/.claude/auto-updater"
    mkdir -p "$CONFIG_DIR"

    # Backup original check.sh
    ORIGINAL_CHECK="${SCRIPT_DIR}/check.sh"
    if [ -f "$ORIGINAL_CHECK" ]; then
        cp "$ORIGINAL_CHECK" "${TEMP_DIR}/check.sh.backup"
    fi
}

teardown() {
    # Restore original check.sh
    if [ -f "${TEMP_DIR}/check.sh.backup" ]; then
        cp "${TEMP_DIR}/check.sh.backup" "$ORIGINAL_CHECK"
    fi
    rm -rf "$TEMP_DIR"
}

# Helper: Set last-check timestamp to N seconds ago
set_last_check_time() {
    local seconds_ago="$1"
    local current_time=$(date +%s)
    local timestamp=$((current_time - seconds_ago))
    echo "$timestamp" > "$CONFIG_DIR/last-check"
}

@test "auto-update-hook.sh: CHECK_INTERVAL is 3600 seconds (1 hour)" {
    grep -q "CHECK_INTERVAL=3600" "$HOOK_DIR/auto-update-hook.sh"
}

@test "auto-update-hook.sh: does NOT run when last check was 3599 seconds ago" {
    set_last_check_time 3599

    # Create mock update.sh
    mkdir -p "$SCRIPT_DIR"
    cat > "$SCRIPT_DIR/update.sh" << 'EOF'
#!/usr/bin/env bash
touch "$HOME/.checker-called"
EOF
    chmod +x "$SCRIPT_DIR/update.sh"

    # Run hook
    bash "$HOOK_DIR/auto-update-hook.sh"

    # Checker should NOT have been called
    [ ! -f "$HOME/.checker-called" ]
}

@test "auto-update-hook.sh: runs when last check was exactly 3600 seconds ago" {
    set_last_check_time 3600

    # Create mock update.sh
    mkdir -p "$SCRIPT_DIR"
    cat > "$SCRIPT_DIR/update.sh" << 'EOF'
#!/usr/bin/env bash
touch "$HOME/.checker-called"
EOF
    chmod +x "$SCRIPT_DIR/update.sh"

    # Run hook
    bash "$HOOK_DIR/auto-update-hook.sh"

    # Checker should have been called
    [ -f "$HOME/.checker-called" ]
}

@test "auto-update-hook.sh: runs when last check was 3601 seconds ago" {
    set_last_check_time 3601

    # Create mock update.sh
    mkdir -p "$SCRIPT_DIR"
    cat > "$SCRIPT_DIR/update.sh" << 'EOF'
#!/usr/bin/env bash
touch "$HOME/.checker-called"
EOF
    chmod +x "$SCRIPT_DIR/update.sh"

    # Run hook
    bash "$HOOK_DIR/auto-update-hook.sh"

    # Checker should have been called
    [ -f "$HOME/.checker-called" ]
}

@test "auto-update-hook.sh: runs when last-check file is missing" {
    # Ensure no timestamp file exists
    rm -f "$CONFIG_DIR/last-check"

    # Create mock update.sh
    mkdir -p "$SCRIPT_DIR"
    cat > "$SCRIPT_DIR/update.sh" << 'EOF'
#!/usr/bin/env bash
touch "$HOME/.checker-called"
EOF
    chmod +x "$SCRIPT_DIR/update.sh"

    # Run hook
    bash "$HOOK_DIR/auto-update-hook.sh"

    # Checker should have been called (first run)
    [ -f "$HOME/.checker-called" ]
}

@test "check.sh: contains timestamp update function" {
    grep -q 'update_last_check_timestamp' "$SCRIPT_DIR/check.sh"
}

@test "check.sh: contains CONFIG_DIR variable" {
    grep -q 'CONFIG_DIR=' "$SCRIPT_DIR/check.sh"
}

@test "check.sh: calls update_last_check_timestamp at end" {
    grep -q 'update_last_check_timestamp' "$SCRIPT_DIR/check.sh"
}
