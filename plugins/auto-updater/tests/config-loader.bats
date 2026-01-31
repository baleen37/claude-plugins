#!/usr/bin/env bats
#
# config-loader.bats
# Tests for config-loader.sh library
#

# Get the test directory
TEST_DIR="$(cd "$(dirname "${BATS_TEST_FILENAME}")" && pwd)"

setup() {
  # Set up test environment
  export TEMP_DIR="${BATS_TMPDIR}/config-loader-test-$$"

  mkdir -p "$TEMP_DIR"
  export HOME="$TEMP_DIR"

  # Create temp directory for test config files
  TEST_CONFIG_DIR="$(mktemp -d)"
  TEST_CONFIG_FILE="${TEST_CONFIG_DIR}/config.json"
}

teardown() {
  rm -rf "$TEMP_DIR"
  rm -rf "$TEST_CONFIG_DIR"
}

# Source the library under test
source "${TEST_DIR}/../scripts/lib/config-loader.sh"

@test "create_default_config creates valid config file" {
  run create_default_config "$TEST_CONFIG_FILE"

  [ -f "$TEST_CONFIG_FILE" ]

  # Verify it's valid JSON
  run jq -e '.marketplaces' "$TEST_CONFIG_FILE"
  [ "$status" -eq 0 ]
}

@test "create_default_config contains baleen-plugins as default" {
  create_default_config "$TEST_CONFIG_FILE"

  run jq -r '.marketplaces[0].name' "$TEST_CONFIG_FILE"
  [ "$output" = "baleen-plugins" ]

  # plugins field should not be present (defaults to all)
  run jq -r '.marketplaces[0].plugins // "all"' "$TEST_CONFIG_FILE"
  [ "$output" = "all" ]
}

@test "load_config creates default config if missing" {
  # Ensure config doesn't exist
  [ ! -f "$TEST_CONFIG_FILE" ]

  run load_config "$TEST_CONFIG_FILE"
  [ "$status" -eq 0 ]

  # Config file should be created
  [ -f "$TEST_CONFIG_FILE" ]
}

@test "load_config fails on invalid config" {
  # Create invalid config
  echo '{"invalid": true}' > "$TEST_CONFIG_FILE"

  run load_config "$TEST_CONFIG_FILE"
  [ "$status" -ne 0 ]
}

@test "get_marketplaces returns all marketplaces" {
  # Create config with multiple marketplaces
  cat > "$TEST_CONFIG_FILE" << EOF
{
  "marketplaces": [
    {"name": "marketplace-1", "source": "example/repo-1"},
    {"name": "marketplace-2", "source": "example/repo-2"},
    {"name": "marketplace-3", "source": "example/repo-3"}
  ]
}
EOF

  run get_marketplaces "$TEST_CONFIG_FILE"
  [ "$status" -eq 0 ]

  # Should return 3 marketplaces
  [ "$(echo "$output" | wc -l)" -eq 3 ]
}

@test "get_marketplace_url converts source to GitHub URL" {
  local marketplace='{"name": "test", "source": "anthropics/claude-plugins-official"}'

  run get_marketplace_url "$marketplace"
  [ "$output" = "https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json" ]
}

@test "get_marketplace_url returns empty when source is missing" {
  local marketplace='{"name": "test"}'

  run get_marketplace_url "$marketplace"
  [ "$status" -ne 0 ]
}

@test "should_install_plugin returns true when plugins is 'all'" {
  local marketplace='{"name": "test", "plugins": "all"}'

  run should_install_plugin "$marketplace" "any-plugin"
  [ "$status" -eq 0 ]
}

@test "should_install_plugin returns true for plugin in list" {
  local marketplace='{"name": "test", "plugins": ["plugin-1", "plugin-2"]}'

  run should_install_plugin "$marketplace" "plugin-1"
  [ "$status" -eq 0 ]
}

@test "should_install_plugin returns false for plugin not in list" {
  local marketplace='{"name": "test", "plugins": ["plugin-1", "plugin-2"]}'

  run should_install_plugin "$marketplace" "plugin-3"
  [ "$status" -ne 0 ]
}

@test "get_marketplace_name extracts name from JSON" {
  local marketplace='{"name": "test-marketplace", "source": "example/repo"}'

  run get_marketplace_name "$marketplace"
  [ "$output" = "test-marketplace" ]
}
