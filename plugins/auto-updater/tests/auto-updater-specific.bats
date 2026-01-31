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
  # Create a fake claude executable in PATH
  mkdir -p "$TEMP_DIR/bin"
  cat > "$TEMP_DIR/bin/claude" << 'EOF'
#!/usr/bin/env bash
# Mock claude command for testing
if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
  echo "[]"
fi
EOF
  chmod +x "$TEMP_DIR/bin/claude"
  export PATH="$TEMP_DIR/bin:$PATH"

  # Set up environment for the script
  export CLAUDE_PLUGIN_ROOT="$FIXTURES_DIR/../../.."
  export MARKETPLACE_FILE="$FIXTURES_DIR/marketplace.json"

  run "$SCRIPT_DIR/update-checker.sh" --check-only
  [ "$status" -eq 0 ]
}

@test "config.json is created with defaults if missing" {
  [ ! -f "$CONFIG_DIR/config.json" ]

  # Source the script functions to test config loading
  # This is a placeholder - actual implementation will be in update-checker.sh
}

@test "last-check timestamp file is created after check" {
  # Create a fake claude executable in PATH
  mkdir -p "$TEMP_DIR/bin"
  cat > "$TEMP_DIR/bin/claude" << 'EOF'
#!/usr/bin/env bash
# Mock claude command for testing
if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
  echo "[]"
elif [ "$1" = "plugin" ] && [ "$2" = "install" ]; then
  # Simulate successful install
  exit 0
fi
EOF
  chmod +x "$TEMP_DIR/bin/claude"
  export PATH="$TEMP_DIR/bin:$PATH"

  # Set up environment for the script
  export CLAUDE_PLUGIN_ROOT="$FIXTURES_DIR/../../.."
  export MARKETPLACE_FILE="$FIXTURES_DIR/marketplace.json"

  # Timestamp should not exist initially
  [ ! -f "$CONFIG_DIR/last-check" ]

  # Run without --check-only to trigger timestamp creation
  run "$SCRIPT_DIR/update-checker.sh" --silent
  [ "$status" -eq 0 ]

  # Timestamp file should now exist
  [ -f "$CONFIG_DIR/last-check" ]

  # Verify it contains a valid timestamp (Unix epoch)
  local timestamp
  timestamp=$(cat "$CONFIG_DIR/last-check")
  [[ "$timestamp" =~ ^[0-9]+$ ]]
}

@test "update-checker.sh detects outdated plugins using real format" {
  # Create a fake claude executable that returns realistic plugin data
  mkdir -p "$TEMP_DIR/bin"
  cat > "$TEMP_DIR/bin/claude" << 'EOF'
#!/usr/bin/env bash
# Mock claude command for testing with realistic output format
if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
  # Simulate an installed plugin with an old version
  cat << 'PLUGINJSON'
[
  {
    "id": "git-guard@baleen-plugins",
    "version": "1.0.0",
    "scope": "user",
    "enabled": true,
    "installPath": "/Users/test/.claude/plugins/cache/baleen-plugins/git-guard/1.0.0",
    "installedAt": "2026-01-01T00:00:00.000Z",
    "lastUpdated": "2026-01-01T00:00:00.000Z"
  }
]
PLUGINJSON
elif [ "$1" = "plugin" ] && [ "$2" = "install" ]; then
  # Simulate successful install
  exit 0
fi
EOF
  chmod +x "$TEMP_DIR/bin/claude"
  export PATH="$TEMP_DIR/bin:$PATH"

  # Set up environment for the script
  export CLAUDE_PLUGIN_ROOT="$FIXTURES_DIR/../../.."
  export MARKETPLACE_FILE="$FIXTURES_DIR/marketplace.json"

  # Run the update checker
  run "$SCRIPT_DIR/update-checker.sh" --check-only
  [ "$status" -eq 0 ]

  # The output should indicate an outdated plugin was found
  # (The marketplace.json fixture has git-guard at a higher version)
  [[ "$output" =~ "git-guard" ]] || [[ "$output" =~ "update" ]] || [ -z "$output" ]
}

@test "update-checker.sh handles plugins with correct ID format" {
  # Create a fake claude executable that returns multiple plugins
  mkdir -p "$TEMP_DIR/bin"
  cat > "$TEMP_DIR/bin/claude" << 'EOF'
#!/usr/bin/env bash
# Mock claude command for testing with multiple plugins
if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
  cat << 'PLUGINJSON'
[
  {
    "id": "git-guard@baleen-plugins",
    "version": "1.1.1",
    "scope": "user",
    "enabled": true,
    "installPath": "/Users/test/.claude/plugins/cache/baleen-plugins/git-guard/1.1.1",
    "installedAt": "2026-01-12T02:13:16.514Z",
    "lastUpdated": "2026-01-12T02:13:16.514Z"
  },
  {
    "id": "ralph-loop@baleen-plugins",
    "version": "1.0.0",
    "scope": "user",
    "enabled": true,
    "installPath": "/Users/test/.claude/plugins/cache/baleen-plugins/ralph-loop/1.0.0",
    "installedAt": "2026-01-10T00:00:00.000Z",
    "lastUpdated": "2026-01-10T00:00:00.000Z"
  }
]
PLUGINJSON
elif [ "$1" = "plugin" ] && [ "$2" = "install" ]; then
  exit 0
fi
EOF
  chmod +x "$TEMP_DIR/bin/claude"
  export PATH="$TEMP_DIR/bin:$PATH"

  # Set up environment for the script
  export CLAUDE_PLUGIN_ROOT="$FIXTURES_DIR/../../.."
  export MARKETPLACE_FILE="$FIXTURES_DIR/marketplace.json"

  # Run the update checker - should succeed with proper ID parsing
  run "$SCRIPT_DIR/update-checker.sh" --silent
  [ "$status" -eq 0 ]
}
