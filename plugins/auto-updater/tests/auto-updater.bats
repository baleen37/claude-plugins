#!/usr/bin/env bats

setup() {
  # Set up test environment
  export TEST_DIR="${BATS_TEST_DIRNAME}"
  export SCRIPT_DIR="${TEST_DIR}/../scripts"
  export FIXTURES_DIR="${TEST_DIR}/fixtures"
  export TEMP_DIR="${BATS_TMPDIR}/auto-updater-test-$$"

  mkdir -p "$TEMP_DIR"
  export HOME="$TEMP_DIR"
  export CONFIG_DIR="$HOME/.claude/auto-updater"
  mkdir -p "$CONFIG_DIR"
}

teardown() {
  rm -rf "$TEMP_DIR"
}

@test "update-checker.sh exists and is executable" {
  [ -f "$SCRIPT_DIR/update-checker.sh" ]
  [ -x "$SCRIPT_DIR/update-checker.sh" ]
}

@test "auto-update-hook.sh exists and is executable" {
  [ -f "${TEST_DIR}/../hooks/auto-update-hook.sh" ]
  [ -x "${TEST_DIR}/../hooks/auto-update-hook.sh" ]
}

@test "update-checker.sh exits silently when marketplace.json doesn't exist" {
  run "$SCRIPT_DIR/update-checker.sh" --silent
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "update-checker.sh can read test marketplace.json" {
  export MARKETPLACE_FILE="$FIXTURES_DIR/marketplace.json"

  # Mock /plugin list to return empty (simulate no plugins installed)
  function /plugin() {
    echo "[]"
  }
  export -f /plugin

  run "$SCRIPT_DIR/update-checker.sh" --check-only
  [ "$status" -eq 0 ]
}

@test "config.json is created with defaults if missing" {
  [ ! -f "$CONFIG_DIR/config.json" ]

  # Source the script functions to test config loading
  # This is a placeholder - actual implementation will be in update-checker.sh
}

@test "last-check timestamp file is created after check" {
  export MARKETPLACE_FILE="$FIXTURES_DIR/marketplace.json"

  function /plugin() {
    echo "[]"
  }
  export -f /plugin

  # This test will validate timestamp file creation
  # Placeholder for now - will be implemented with actual script
}
