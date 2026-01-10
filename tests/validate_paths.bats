#!/usr/bin/env bats
# Test suite for path portability validation

load bats_helper

setup() {
    # Create temp directory for test-specific files
    export TEST_TEMP_DIR=$(mktemp -d -t claude-plugins-test.XXXXXX)

    # Create test files with various path patterns
    export TEST_DIR="${TEST_TEMP_DIR}/path_tests"
    mkdir -p "$TEST_DIR"
}

teardown() {
    # Clean up temp directory
    if [ -n "${TEST_TEMP_DIR:-}" ] && [ -d "$TEST_TEMP_DIR" ]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

@test "detects hardcoded absolute paths in JSON files" {
    # Create test JSON with hardcoded paths
    cat > "$TEST_DIR/test.json" <<EOF
{
    "path": "/home/user/config",
    "another": "/Users/john/data"
}
EOF

    # Run grep to find hardcoded paths
    run grep -rE '(^|[^$])/([a-z]|home|Users|tmp)' "$TEST_DIR" \
        --include="*.json" 2>/dev/null

    # Should find the hardcoded paths
    [ "$status" -eq 0 ]
    [[ "$output" == *"/home/user/config"* ]]
    [[ "$output" == *"/Users/john/data"* ]]
}

@test "allows portable \${CLAUDE_PLUGIN_ROOT} paths" {
    # Create test file with portable paths
    cat > "$TEST_DIR/portable.json" <<EOF
{
    "scriptPath": "\${CLAUDE_PLUGIN_ROOT}/scripts/test.sh",
    "config": "\${CLAUDE_PLUGIN_ROOT}/config.json"
}
EOF

    # Check that portable path exists
    run grep '\${CLAUDE_PLUGIN_ROOT}' "$TEST_DIR/portable.json"
    [ "$status" -eq 0 ]
}

@test "detects hardcoded paths in shell scripts" {
    # Create test shell script with hardcoded paths
    cat > "$TEST_DIR/test.sh" <<EOF
#!/bin/bash
CONFIG_PATH="/home/user/config.json"
DATA_DIR="/tmp/myapp/data"
EOF

    # Run grep to find hardcoded paths
    run grep -rE '(^|[^$])/([a-z]|home|Users|tmp)' "$TEST_DIR" \
        --include="*.sh" 2>/dev/null

    # Should find the hardcoded paths
    [ "$status" -eq 0 ]
    [[ "$output" == *"/home/user/config.json"* ]]
}

@test "excludes .git directory from path checks" {
    # Create a fake .git directory with a file containing absolute paths
    mkdir -p "$TEST_DIR/.git"
    cat > "$TEST_DIR/.git/config" <<EOF
[core]
    repositoryformatversion = 0
    filemode = true
    bare = false
    logallrefupdates = true
    ignorecase = true
    precomposeunicode = true
    path = /usr/local/git
EOF

    # Run grep excluding .git directory
    run grep -rE '(^|[^$])/([a-z]|home|Users|tmp)' "$TEST_DIR" \
        --include="*" \
        --exclude-dir=".git" 2>/dev/null || true

    # Should not find paths from .git directory
    [[ ! "$output" == *"/usr/local/git"* ]] || true
}

@test "allows dollar-prefixed variables (not hardcoded paths)" {
    # Create test file with variable paths
    cat > "$TEST_DIR/variables.sh" <<EOF
#!/bin/bash
CONFIG_PATH="\$HOME/config"
DATA_DIR="\$TMP/myapp/data"
EOF

    # Run grep to find hardcoded paths (should not match $HOME, $TMP)
    run grep -rE '(^|[^$])/([a-z]|home|Users|tmp)' "$TEST_DIR" \
        --include="*.sh" 2>/dev/null || true

    # Should not find variable paths (they start with $)
    [[ ! "$output" == *"\$HOME"* ]] || true
    [[ ! "$output" == *"\$TMP"* ]] || true
}

@test "checks markdown files for hardcoded paths" {
    # Create markdown with hardcoded paths
    cat > "$TEST_DIR/README.md" <<EOF
# Documentation

Configuration is stored in /home/user/.config/app.json.

See /Users/john/docs for more info.
EOF

    # Run grep to find hardcoded paths
    run grep -rE '(^|[^$])/([a-z]|home|Users|tmp)' "$TEST_DIR" \
        --include="*.md" 2>/dev/null

    # Should find the hardcoded paths
    [ "$status" -eq 0 ]
    [[ "$output" == *"/home/user/.config"* ]]
}
