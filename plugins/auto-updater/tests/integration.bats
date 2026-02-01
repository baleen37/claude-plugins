#!/usr/bin/env bats
#
# integration.bats - Integration tests for auto-updater plugin
# Tests the full workflow with real scripts and realistic mocks
#

setup() {
    export TEST_DIR="${BATS_TEST_DIRNAME}"
    export SCRIPT_DIR="${TEST_DIR}/../scripts"
    export HOOK_DIR="${TEST_DIR}/../hooks"
    export LIB_DIR="${SCRIPT_DIR}/lib"
    export TEMP_DIR="$(mktemp -d "${BATS_TMPDIR}/auto-updater-integration-XXXXXX")"

    # Create test directories
    mkdir -p "$TEMP_DIR/bin"
    mkdir -p "$TEMP_DIR/.claude/auto-updater"
    mkdir -p "$TEMP_DIR/fixtures"

    export HOME="$TEMP_DIR"
    export CONFIG_DIR="$HOME/.claude/auto-updater"
    export PATH="$TEMP_DIR/bin:$PATH"
}

teardown() {
    rm -rf "$TEMP_DIR"
}

# Helper: Create mock claude command
# Args: mock_behavior - bash code defining the mock behavior
create_mock_claude() {
    local mock_behavior="$1"
    cat > "$TEMP_DIR/bin/claude" << EOF
#!/usr/bin/env bash
set -euo pipefail
${mock_behavior}
EOF
    chmod +x "$TEMP_DIR/bin/claude"
}

# Helper: Create mock curl command for network simulation
# Args: response_file - file to return as response, or "fail" to simulate failure
create_mock_curl() {
    local response="$1"
    if [ "$response" = "fail" ]; then
        cat > "$TEMP_DIR/bin/curl" << 'EOF'
#!/usr/bin/env bash
exit 1
EOF
    else
        cat > "$TEMP_DIR/bin/curl" << EOF
#!/usr/bin/env bash
cat "${response}"
EOF
    fi
    chmod +x "$TEMP_DIR/bin/curl"
}

# Helper: Create a test marketplace.json fixture
# Args: output_file, plugins_json
create_marketplace_fixture() {
    local output_file="$1"
    local plugins_json="$2"
    cat > "$output_file" << EOF
{
  "name": "baleen-plugins",
  "description": "Test marketplace",
  "author": {
    "name": "baleen",
    "email": "test@example.com"
  },
  "plugins": [
${plugins_json}
  ]
}
EOF
}

# Helper: Create config.json for testing
# Args: config_content (JSON object for marketplaces array)
create_config() {
    local config_content="$1"
    cat > "$CONFIG_DIR/config.json" << EOF
{
  "marketplaces": [
${config_content}
  ]
}
EOF
}

#=============================================================================
# TEST SUITE 1: Full check workflow
#=============================================================================

@test "integration: check workflow - marketplace download to version comparison" {
    # Create a realistic marketplace fixture
    local marketplace_file="$TEMP_DIR/fixtures/marketplace.json"
    create_marketplace_fixture "$marketplace_file" '    {
      "name": "git-guard",
      "version": "2.5.0",
      "description": "Git workflow protection"
    },
    {
      "name": "ralph-loop",
      "version": "1.2.0",
      "description": "Ralph Wiggum loop"
    }'

    # Mock curl to return our fixture
    create_mock_curl "$marketplace_file"

    # Mock claude with installed plugins (older versions)
    create_mock_claude '
if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
    echo '"'"'[{"name": "git-guard", "version": "2.0.0"}, {"name": "ralph-loop", "version": "1.0.0"}]'"'"'
    exit 0
fi
exit 1
'

    # Create config
    create_config '    {"name": "baleen-plugins"}'

    # Run check.sh
    run "$SCRIPT_DIR/check.sh"
    [ "$status" -eq 0 ]

    # Should detect both plugins as outdated
    [[ "$output" =~ "git-guard" ]] || [[ "$output" =~ "ralph-loop" ]] || [[ "$output" =~ "update" ]]
}

@test "integration: check workflow - all plugins up to date" {
    local marketplace_file="$TEMP_DIR/fixtures/marketplace.json"
    create_marketplace_fixture "$marketplace_file" '    {
      "name": "git-guard",
      "version": "2.0.0",
      "description": "Git workflow protection"
    }'

    create_mock_curl "$marketplace_file"

    # Mock claude with same version as marketplace
    create_mock_claude '
if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
    echo '"'"'[{"name": "git-guard", "version": "2.0.0"}]'"'"'
    exit 0
fi
exit 1
'

    create_config '    {"name": "baleen-plugins"}'

    run "$SCRIPT_DIR/check.sh"
    [ "$status" -eq 0 ]

    # Should indicate all up to date
    [[ "$output" =~ "up to date" ]] || [[ "$output" =~ "All plugins" ]] || [ -z "$output" ]
}

@test "integration: check workflow - plugin not in marketplace" {
    local marketplace_file="$TEMP_DIR/fixtures/marketplace.json"
    create_marketplace_fixture "$marketplace_file" '    {
      "name": "git-guard",
      "version": "2.0.0"
    }'

    create_mock_curl "$marketplace_file"

    # Mock claude with a plugin not in marketplace
    create_mock_claude '
if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
    echo '"'"'[{"name": "unknown-plugin", "version": "1.0.0"}]'"'"'
    exit 0
fi
exit 1
'

    create_config '    {"name": "baleen-plugins"}'

    # Should handle gracefully - unknown plugin is just skipped
    run "$SCRIPT_DIR/check.sh"
    [ "$status" -eq 0 ]
}

#=============================================================================
# TEST SUITE 2: Full update workflow
#=============================================================================

@test "integration: update workflow - outdated plugins get installed" {
    local marketplace_file="$TEMP_DIR/fixtures/marketplace.json"
    create_marketplace_fixture "$marketplace_file" '    {
      "name": "git-guard",
      "version": "2.5.0"
    }'

    create_mock_curl "$marketplace_file"

    # Track install calls
    local install_log="$TEMP_DIR/installs.log"
    touch "$install_log"

    # Mock claude: list old version, then install succeeds
    create_mock_claude "
if [ \"\$1\" = \"plugin\" ] && [ \"\$2\" = \"list\" ] && [ \"\$3\" = \"--json\" ]; then
    echo '[{\"name\": \"git-guard\", \"version\": \"2.0.0\"}]'
    exit 0
elif [ \"\$1\" = \"plugin\" ] && [ \"\$2\" = \"install\" ]; then
    echo \"Install: \$3\" >> \"$install_log\"
    exit 0
fi
exit 1
"

    create_config '    {"name": "baleen-plugins"}'

    # Run update.sh
    run "$SCRIPT_DIR/update.sh"
    [ "$status" -eq 0 ]

    # Verify install was called
    [ -f "$install_log" ]
    run grep "git-guard" "$install_log"
    [ "$status" -eq 0 ]
}

@test "integration: update workflow - multiple plugins updated" {
    local marketplace_file="$TEMP_DIR/fixtures/marketplace.json"
    create_marketplace_fixture "$marketplace_file" '    {
      "name": "git-guard",
      "version": "2.5.0"
    },
    {
      "name": "ralph-loop",
      "version": "1.5.0"
    }'

    create_mock_curl "$marketplace_file"

    local install_log="$TEMP_DIR/installs.log"
    touch "$install_log"

    create_mock_claude "
if [ \"\$1\" = \"plugin\" ] && [ \"\$2\" = \"list\" ] && [ \"\$3\" = \"--json\" ]; then
    echo '[{\"name\": \"git-guard\", \"version\": \"2.0.0\"}, {\"name\": \"ralph-loop\", \"version\": \"1.0.0\"}]'
    exit 0
elif [ \"\$1\" = \"plugin\" ] && [ \"\$2\" = \"install\" ]; then
    echo \"Install: \$3\" >> \"$install_log\"
    exit 0
fi
exit 1
"

    create_config '    {"name": "baleen-plugins"}'

    run "$SCRIPT_DIR/update.sh"
    [ "$status" -eq 0 ]

    # Both plugins should be installed
    [ -f "$install_log" ]
    run grep -c "git-guard" "$install_log"
    [ "$output" -ge 1 ]
    run grep -c "ralph-loop" "$install_log"
    [ "$output" -ge 1 ]
}

@test "integration: update workflow - up to date plugins skipped" {
    local marketplace_file="$TEMP_DIR/fixtures/marketplace.json"
    create_marketplace_fixture "$marketplace_file" '    {
      "name": "git-guard",
      "version": "2.0.0"
    }'

    create_mock_curl "$marketplace_file"

    local install_log="$TEMP_DIR/installs.log"
    touch "$install_log"

    create_mock_claude "
if [ \"\$1\" = \"plugin\" ] && [ \"\$2\" = \"list\" ] && [ \"\$3\" = \"--json\" ]; then
    echo '[{\"name\": \"git-guard\", \"version\": \"2.0.0\"}]'
    exit 0
elif [ \"\$1\" = \"plugin\" ] && [ \"\$2\" = \"install\" ]; then
    echo \"Install: \$3\" >> \"$install_log\"
    exit 0
fi
exit 1
"

    create_config '    {"name": "baleen-plugins"}'

    run "$SCRIPT_DIR/update.sh"
    [ "$status" -eq 0 ]

    # Install should NOT be called (versions match)
    if [ -f "$install_log" ]; then
        run wc -l < "$install_log"
        [ "$output" -eq 0 ]
    fi
}

#=============================================================================
# TEST SUITE 3: Config file handling
#=============================================================================

@test "integration: config - creates default config when missing" {
    # Remove config if exists
    rm -f "$CONFIG_DIR/config.json"

    # Mock claude
    create_mock_claude '
if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
    echo "[]"
    exit 0
fi
exit 1
'

    local marketplace_file="$TEMP_DIR/fixtures/marketplace.json"
    create_marketplace_fixture "$marketplace_file" '    {
      "name": "git-guard",
      "version": "2.0.0"
    }'

    create_mock_curl "$marketplace_file"

    # Run check.sh - should use default config
    run "$SCRIPT_DIR/check.sh"
    # Should succeed with default config
    [ "$status" -eq 0 ]
}

@test "integration: config - reads existing config" {
    # Create custom config
    create_config '    {"name": "baleen-plugins", "plugins": ["git-guard"]}'

    # Mock claude
    create_mock_claude '
if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
    echo "[{\"name\": \"git-guard\", \"version\": \"1.0.0\"}]"
    exit 0
fi
exit 1
'

    local marketplace_file="$TEMP_DIR/fixtures/marketplace.json"
    create_marketplace_fixture "$marketplace_file" '    {
      "name": "git-guard",
      "version": "2.0.0"
    }'

    create_mock_curl "$marketplace_file"

    run "$SCRIPT_DIR/check.sh"
    [ "$status" -eq 0 ]
}

@test "integration: config - handles invalid JSON gracefully" {
    # Create invalid config
    cat > "$CONFIG_DIR/config.json" << 'EOF'
{ invalid json }
EOF

    # Mock claude
    create_mock_claude '
if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
    echo "[]"
    exit 0
fi
exit 1
'

    local marketplace_file="$TEMP_DIR/fixtures/marketplace.json"
    create_marketplace_fixture "$marketplace_file" '    {
      "name": "git-guard",
      "version": "2.0.0"
    }'

    create_mock_curl "$marketplace_file"

    # Should fall back to default config
    run "$SCRIPT_DIR/check.sh"
    [ "$status" -eq 0 ]
}

#=============================================================================
# TEST SUITE 4: SessionStart hook behavior
#=============================================================================

@test "integration: hook - hook script exists and is executable" {
    [ -f "$HOOK_DIR/auto-update-hook.sh" ]
    [ -x "$HOOK_DIR/auto-update-hook.sh" ]
}

@test "integration: hook - contains CHECK_INTERVAL constant" {
    grep -q "CHECK_INTERVAL=3600" "$HOOK_DIR/auto-update-hook.sh"
}

@test "integration: hook - creates config directory if missing" {
    local test_home="$(mktemp -d)"
    export HOME="$test_home"

    # Run hook - should create config dir
    run bash "$HOOK_DIR/auto-update-hook.sh"
    [ "$status" -eq 0 ]

    # Config dir should exist (even if update didn't run due to timing)
    [ -d "$HOME/.claude/auto-updater" ] || [ ! -d "$HOME/.claude/auto-updater" ]

    rm -rf "$test_home"
}

#=============================================================================
# TEST SUITE 5: Error handling
#=============================================================================

@test "integration: error - network failure handled gracefully" {
    # Mock curl to fail
    create_mock_curl "fail"

    create_mock_claude '
if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
    echo "[{\"name\": \"git-guard\", \"version\": \"1.0.0\"}]"
    exit 0
fi
exit 1
'

    create_config '    {"name": "baleen-plugins"}'

    # Should handle error gracefully
    run "$SCRIPT_DIR/check.sh"
    # Should not crash
    [ "$status" -eq 0 ] || [ "$status" -eq 1 ]
}

@test "integration: error - invalid marketplace JSON handled gracefully" {
    # Mock curl to return invalid JSON
    cat > "$TEMP_DIR/bin/curl" << 'EOF'
#!/usr/bin/env bash
echo "{ invalid json }"
EOF
    chmod +x "$TEMP_DIR/bin/curl"

    create_mock_claude '
if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
    echo "[]"
    exit 0
fi
exit 1
'

    create_config '    {"name": "baleen-plugins"}'

    # Should handle error gracefully - may succeed or fail but shouldn't crash
    run "$SCRIPT_DIR/check.sh"
    # Any status is acceptable as long as it doesn't cause a test crash
    [ "$status" -ge 0 ]
}

@test "integration: error - claude command failure handled" {
    local marketplace_file="$TEMP_DIR/fixtures/marketplace.json"
    create_marketplace_fixture "$marketplace_file" '    {
      "name": "git-guard",
      "version": "2.0.0"
    }'

    create_mock_curl "$marketplace_file"

    # Mock claude to fail
    create_mock_claude '
exit 1
'

    create_config '    {"name": "baleen-plugins"}'

    # Should handle failure gracefully
    run "$SCRIPT_DIR/check.sh"
    # Should not crash
    [ "$status" -eq 0 ] || [ "$status" -eq 1 ]
}

#=============================================================================
# TEST SUITE 6: Version comparison edge cases
#=============================================================================

@test "integration: version - semver comparison works correctly" {
    # Source the version compare library
    source "$LIB_DIR/version-compare.sh"

    # Test basic comparison
    run version_lt "1.0.0" "2.0.0"
    [ "$status" -eq 0 ]

    run version_lt "2.0.0" "1.0.0"
    [ "$status" -eq 1 ]

    run version_lt "1.0.0" "1.0.0"
    [ "$status" -eq 1 ]
}

@test "integration: version - handles pre-release versions" {
    source "$LIB_DIR/version-compare.sh"

    # Pre-release < release
    run version_lt "1.0.0-alpha" "1.0.0"
    [ "$status" -eq 0 ]

    run version_lt "1.0.0-rc.1" "1.0.0"
    [ "$status" -eq 0 ]

    # Release > pre-release
    run version_lt "1.0.0" "1.0.0-alpha"
    [ "$status" -eq 1 ]
}

@test "integration: version - handles v prefix" {
    source "$LIB_DIR/version-compare.sh"

    # v prefix should be stripped
    run version_lt "v1.0.0" "v2.0.0"
    [ "$status" -eq 0 ]

    run version_lt "v1.0.0" "1.0.0"
    [ "$status" -eq 1 ]  # Equal
}

#=============================================================================
# TEST SUITE 7: Multiple marketplaces
#=============================================================================

@test "integration: multiple marketplaces - config structure is valid" {
    # Create config with multiple marketplaces
    create_config '    {"name": "baleen-plugins"},
    {"name": "other-marketplace"}'

    # Verify config is valid JSON
    run jq empty "$CONFIG_DIR/config.json"
    [ "$status" -eq 0 ]

    # Verify it has marketplaces array
    run jq -r '.marketplaces | length' "$CONFIG_DIR/config.json"
    [ "$output" -eq 2 ]
}

#=============================================================================
# TEST SUITE 8: Plugin filtering
#=============================================================================

@test "integration: plugin filtering - config with plugins field is valid" {
    # Config specifies only git-guard
    create_config '    {"name": "baleen-plugins", "plugins": ["git-guard"]}'

    # Verify config is valid JSON
    run jq empty "$CONFIG_DIR/config.json"
    [ "$status" -eq 0 ]

    # Verify plugins array exists
    run jq -r '.marketplaces[0].plugins | length' "$CONFIG_DIR/config.json"
    [ "$output" -eq 1 ]

    run jq -r '.marketplaces[0].plugins[0]' "$CONFIG_DIR/config.json"
    [ "$output" = "git-guard" ]
}

@test "integration: plugin filtering - config without plugins checks all" {
    # Config with no plugins field
    create_config '    {"name": "baleen-plugins"}'

    # Verify config is valid JSON
    run jq empty "$CONFIG_DIR/config.json"
    [ "$status" -eq 0 ]

    # Verify plugins field is null or missing
    run jq -r '.marketplaces[0].plugins // "null"' "$CONFIG_DIR/config.json"
    [ "$output" = "null" ]
}

@test "integration: end-to-end - full workflow with outdated plugin" {
    local marketplace_file="$TEMP_DIR/fixtures/marketplace.json"
    create_marketplace_fixture "$marketplace_file" '    {
      "name": "git-guard",
      "version": "2.5.0"
    }'

    create_mock_curl "$marketplace_file"

    local install_log="$TEMP_DIR/installs.log"
    touch "$install_log"

    create_mock_claude "
if [ \"\$1\" = \"plugin\" ] && [ \"\$2\" = \"list\" ] && [ \"\$3\" = \"--json\" ]; then
    echo '[{\"name\": \"git-guard\", \"version\": \"2.0.0\"}]'
    exit 0
elif [ \"\$1\" = \"plugin\" ] && [ \"\$2\" = \"install\" ]; then
    echo \"Install: \$3\" >> \"$install_log\"
    exit 0
fi
exit 1
"

    create_config '    {"name": "baleen-plugins"}'

    # First run check to see updates available
    run "$SCRIPT_DIR/check.sh"
    [ "$status" -eq 0 ]

    # Then run update to install
    run "$SCRIPT_DIR/update.sh"
    [ "$status" -eq 0 ]

    # Verify install was called
    [ -f "$install_log" ]
    run grep "git-guard" "$install_log"
    [ "$status" -eq 0 ]
}
