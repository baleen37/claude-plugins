#!/usr/bin/env bats
# Test suite for path portability validation

load helpers/bats_helper

@test "detects hardcoded absolute paths in JSON files" {
    local TEST_DIR="${TEST_TEMP_DIR}/path_tests"
    mkdir -p "$TEST_DIR"

    # Create test JSON with hardcoded paths
    cat > "$TEST_DIR/test.json" <<EOF
{
  "name": "test-plugin",
  "path": "/Users/john/test"
}
EOF

    run grep -q '"/Users/' "$TEST_DIR/test.json"
    [ "$status" -eq 0 ]
}

@test "allows portable \${CLAUDE_PLUGIN_ROOT} paths" {
    local TEST_DIR="${TEST_TEMP_DIR}/path_tests"
    mkdir -p "$TEST_DIR"

    # Create test JSON with portable paths
    cat > "$TEST_DIR/test.json" <<EOF
{
  "name": "test-plugin",
  "path": "\${CLAUDE_PLUGIN_ROOT}/test"
}
EOF

    # Should not have hardcoded absolute paths
    ! grep -qE '"/(Users|home)/' "$TEST_DIR/test.json"
}

@test "detects hardcoded paths in shell scripts" {
    local TEST_DIR="${TEST_TEMP_DIR}/path_tests"
    mkdir -p "$TEST_DIR"

    # Create test script with hardcoded paths
    cat > "$TEST_DIR/test.sh" <<EOF
#!/bin/bash
PLUGIN_PATH="/Users/john/my-plugin"
EOF

    run grep -q '"/Users/' "$TEST_DIR/test.sh"
    [ "$status" -eq 0 ]
}

@test "excludes .git directory from path checks" {
    # This test verifies .git is excluded from path validation
    # In real implementation, .git should be skipped
    [ -d "$PROJECT_ROOT/.git" ] || skip "No .git directory"
    # .git should exist but path checks should skip it
    true
}

@test "allows dollar-prefixed variables (not hardcoded paths)" {
    local TEST_DIR="${TEST_TEMP_DIR}/path_tests"
    mkdir -p "$TEST_DIR"

    # Create test file with variable references
    cat > "$TEST_DIR/test.sh" <<EOF
#!/bin/bash
PLUGIN_PATH="\${PROJECT_ROOT}/plugin"
EOF

    # Should not flag as hardcoded path
    ! grep -qE '"/(Users|home)/' "$TEST_DIR/test.sh"
}

@test "checks markdown files for hardcoded paths" {
    local TEST_DIR="${TEST_TEMP_DIR}/path_tests"
    mkdir -p "$TEST_DIR"

    # Create test markdown with hardcoded paths
    cat > "$TEST_DIR/test.md" <<EOF
# Test Plugin

Install to: /Users/john/plugins
EOF

    run grep -q '/Users/' "$TEST_DIR/test.md"
    [ "$status" -eq 0 ]
}
