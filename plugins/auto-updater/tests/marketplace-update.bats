#!/usr/bin/env bats
# Integration tests for marketplace update functionality

setup() {
  # Set up test environment
  export TEST_DIR="${BATS_TEST_DIRNAME}"
  export SCRIPT_DIR="${TEST_DIR}/../scripts"
  export FIXTURES_DIR="${TEST_DIR}/fixtures"
  export TEMP_DIR="$(mktemp -d "${BATS_TMPDIR}/auto-updater-marketplace-XXXXXX")"

  mkdir -p "$TEMP_DIR"
  export HOME="$TEMP_DIR"
  export CONFIG_DIR="$HOME/.claude/auto-updater"
  mkdir -p "$CONFIG_DIR"
}

teardown() {
  rm -rf "$TEMP_DIR"
}

@test "fetch_marketplace: downloads marketplace.json from GitHub" {
  # Source the script to get fetch_marketplace function
  export CLAUDE_PLUGIN_ROOT="$FIXTURES_DIR/../../.."
  export MARKETPLACE_CACHE="$CONFIG_DIR/marketplace.json"
  export MARKETPLACE_URL="https://raw.githubusercontent.com/baleen37/claude-plugins/main/.claude-plugin/marketplace.json"

  # Execute the script which calls fetch_marketplace
  source "$SCRIPT_DIR/update-checker.sh" 2>/dev/null || true

  # Verify marketplace.json was downloaded
  [ -f "$MARKETPLACE_CACHE" ]

  # Verify it's valid JSON
  run jq -e '.plugins' "$MARKETPLACE_CACHE"
  [ "$status" -eq 0 ]
}

@test "fetch_marketplace: uses cached file if download fails" {
  # Create a pre-existing cache
  mkdir -p "$CONFIG_DIR"
  echo '{"plugins":[{"name":"test","version":"1.0.0"}]}' > "$CONFIG_DIR/marketplace.json"

  # Mock curl to fail
  mkdir -p "$TEMP_DIR/bin"
  cat > "$TEMP_DIR/bin/curl" << 'EOF'
#!/usr/bin/env bash
# Always fail
exit 1
EOF
  chmod +x "$TEMP_DIR/bin/curl"
  export PATH="$TEMP_DIR/bin:$PATH"

  # Mock claude command
  cat > "$TEMP_DIR/bin/claude" << 'EOF'
#!/usr/bin/env bash
if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
  echo "[]"
  exit 0
fi
exit 0
EOF
  chmod +x "$TEMP_DIR/bin/claude"

  # Set up environment
  export CLAUDE_PLUGIN_ROOT="$FIXTURES_DIR/../../.."
  export MARKETPLACE_CACHE="$CONFIG_DIR/marketplace.json"
  export MARKETPLACE_URL="https://invalid-url-that-will-fail.example.com/marketplace.json"

  # Run the script - should use cached file
  run "$SCRIPT_DIR/update-checker.sh" --check-only --silent
  [ "$status" -eq 0 ]

  # Verify cached file still exists and is unchanged
  [ -f "$MARKETPLACE_CACHE" ]
  run jq -r '.plugins[0].name' "$MARKETPLACE_CACHE"
  [ "$output" = "test" ]
}

@test "update-checker.sh calls 'claude plugin marketplace update'" {
  # Create a mock claude command that logs calls
  mkdir -p "$TEMP_DIR/bin"
  cat > "$TEMP_DIR/bin/claude" << 'EOF'
#!/usr/bin/env bash
# Log all calls to a file
echo "$@" >> "$HOME/claude-calls.log"

if [ "$1" = "plugin" ] && [ "$2" = "marketplace" ] && [ "$3" = "update" ]; then
  # Simulate successful marketplace update
  echo "Updating marketplace: $4..." >&2
  echo "✔ Successfully updated marketplace: $4" >&2
  exit 0
elif [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
  echo "[]"
  exit 0
fi
exit 0
EOF
  chmod +x "$TEMP_DIR/bin/claude"
  export PATH="$TEMP_DIR/bin:$PATH"

  # Set up environment
  export CLAUDE_PLUGIN_ROOT="$FIXTURES_DIR/../../.."
  export MARKETPLACE_FILE="$FIXTURES_DIR/marketplace.json"

  # Run update-checker (not --check-only, so it should call marketplace update)
  run "$SCRIPT_DIR/update-checker.sh" --silent
  [ "$status" -eq 0 ]

  # Verify claude plugin marketplace update was called
  [ -f "$HOME/claude-calls.log" ]
  run grep "plugin marketplace update baleen-plugins" "$HOME/claude-calls.log"
  [ "$status" -eq 0 ]
}

@test "update-checker.sh skips marketplace update when --check-only is used" {
  # Create a mock claude command that logs calls
  mkdir -p "$TEMP_DIR/bin"
  cat > "$TEMP_DIR/bin/claude" << 'EOF'
#!/usr/bin/env bash
echo "$@" >> "$HOME/claude-calls.log"

if [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
  echo "[]"
  exit 0
fi
exit 0
EOF
  chmod +x "$TEMP_DIR/bin/claude"
  export PATH="$TEMP_DIR/bin:$PATH"

  # Set up environment
  export CLAUDE_PLUGIN_ROOT="$FIXTURES_DIR/../../.."
  export MARKETPLACE_FILE="$FIXTURES_DIR/marketplace.json"

  # Run with --check-only
  run "$SCRIPT_DIR/update-checker.sh" --check-only --silent
  [ "$status" -eq 0 ]

  # Verify marketplace update was NOT called
  if [ -f "$HOME/claude-calls.log" ]; then
    run grep "plugin marketplace update" "$HOME/claude-calls.log"
    [ "$status" -ne 0 ]  # Should NOT find it
  fi
}

@test "update-checker.sh detects and handles duplicate plugin installations" {
  # Create a mock claude that returns duplicate plugins
  mkdir -p "$TEMP_DIR/bin"
  cat > "$TEMP_DIR/bin/claude" << 'EOF'
#!/usr/bin/env bash
if [ "$1" = "plugin" ] && [ "$2" = "marketplace" ] && [ "$3" = "update" ]; then
  echo "✔ Successfully updated marketplace: $4" >&2
  exit 0
elif [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
  # Return duplicate installations (different marketplaces)
  cat << 'PLUGINJSON'
[
  {
    "id": "git-guard@baleen-plugins",
    "version": "2.24.7",
    "scope": "user"
  },
  {
    "id": "git-guard@claude-plugins-official",
    "version": "unknown",
    "scope": "user"
  }
]
PLUGINJSON
  exit 0
elif [ "$1" = "plugin" ] && [ "$2" = "update" ]; then
  exit 0
fi
exit 0
EOF
  chmod +x "$TEMP_DIR/bin/claude"
  export PATH="$TEMP_DIR/bin:$PATH"

  # Set up environment
  export CLAUDE_PLUGIN_ROOT="$FIXTURES_DIR/../../.."
  export MARKETPLACE_FILE="$FIXTURES_DIR/marketplace.json"

  # Run update-checker - should not crash despite duplicate
  run "$SCRIPT_DIR/update-checker.sh" --silent
  [ "$status" -eq 0 ]
}

@test "integration: full update workflow with outdated plugin" {
  # Create a mock claude that simulates a full update workflow
  mkdir -p "$TEMP_DIR/bin"
  cat > "$TEMP_DIR/bin/claude" << 'EOF'
#!/usr/bin/env bash
echo "$@" >> "$HOME/claude-calls.log"

if [ "$1" = "plugin" ] && [ "$2" = "marketplace" ] && [ "$3" = "update" ]; then
  echo "Updating marketplace: $4..." >&2
  echo "✔ Successfully updated marketplace: $4" >&2
  exit 0
elif [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
  # Return an outdated plugin
  cat << 'PLUGINJSON'
[
  {
    "id": "git-guard@baleen-plugins",
    "version": "1.0.0",
    "scope": "user",
    "enabled": true
  }
]
PLUGINJSON
  exit 0
elif [ "$1" = "plugin" ] && [ "$2" = "update" ]; then
  # Log the update
  echo "Updated: $3" >> "$HOME/updates.log"
  exit 0
fi
exit 0
EOF
  chmod +x "$TEMP_DIR/bin/claude"
  export PATH="$TEMP_DIR/bin:$PATH"

  # Create a marketplace with newer version (1.0.0 -> 1.1.0)
  mkdir -p "$CONFIG_DIR"
  cat > "$CONFIG_DIR/marketplace.json" << 'EOF'
{
  "name": "baleen-plugins",
  "plugins": [
    {
      "name": "git-guard",
      "version": "1.1.0",
      "source": "https://github.com/baleen37/claude-plugins"
    }
  ]
}
EOF

  # Set up environment
  export CLAUDE_PLUGIN_ROOT="$FIXTURES_DIR/../../.."
  export MARKETPLACE_FILE="$CONFIG_DIR/marketplace.json"

  # Run full update (not --check-only)
  run "$SCRIPT_DIR/update-checker.sh" --silent
  [ "$status" -eq 0 ]

  # Verify workflow steps occurred
  [ -f "$HOME/claude-calls.log" ]

  # Should have called marketplace update
  grep "plugin marketplace update baleen-plugins" "$HOME/claude-calls.log"

  # Should have called plugin update
  grep "plugin update git-guard@baleen-plugins" "$HOME/claude-calls.log"
}

@test "integration: updates all outdated plugins regardless of version bump type" {
  # Create a mock claude
  mkdir -p "$TEMP_DIR/bin"
  cat > "$TEMP_DIR/bin/claude" << 'EOF'
#!/usr/bin/env bash
echo "$@" >> "$HOME/claude-calls.log"

if [ "$1" = "plugin" ] && [ "$2" = "marketplace" ] && [ "$3" = "update" ]; then
  echo "✔ Successfully updated marketplace: $4" >&2
  exit 0
elif [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
  # Current version: 1.0.0
  cat << 'PLUGINJSON'
[
  {
    "id": "git-guard@baleen-plugins",
    "version": "1.0.0",
    "scope": "user"
  }
]
PLUGINJSON
  exit 0
elif [ "$1" = "plugin" ] && [ "$2" = "update" ]; then
  echo "Updated: $3" >> "$HOME/updates.log"
  exit 0
fi
exit 0
EOF
  chmod +x "$TEMP_DIR/bin/claude"
  export PATH="$TEMP_DIR/bin:$PATH"

  # Create marketplace with major version bump (1.0.0 -> 2.0.0)
  mkdir -p "$CONFIG_DIR"
  cat > "$CONFIG_DIR/marketplace.json" << 'EOF'
{
  "name": "baleen-plugins",
  "plugins": [
    {
      "name": "git-guard",
      "version": "2.0.0",
      "source": "https://github.com/baleen37/claude-plugins"
    }
  ]
}
EOF

  export CLAUDE_PLUGIN_ROOT="$FIXTURES_DIR/../../.."
  export MARKETPLACE_FILE="$CONFIG_DIR/marketplace.json"

  # Run update-checker - should update even for major version bump
  run "$SCRIPT_DIR/update-checker.sh" --silent
  [ "$status" -eq 0 ]

  # Should update (all version bumps are allowed)
  [ -f "$HOME/updates.log" ]
  grep "git-guard" "$HOME/updates.log"
}

@test "integration: installs new plugins not previously installed" {
  # Create a mock claude
  mkdir -p "$TEMP_DIR/bin"
  cat > "$TEMP_DIR/bin/claude" << 'EOF'
#!/usr/bin/env bash
echo "$@" >> "$HOME/claude-calls.log"

if [ "$1" = "plugin" ] && [ "$2" = "marketplace" ] && [ "$3" = "update" ]; then
  echo "✔ Successfully updated marketplace: $4" >&2
  exit 0
elif [ "$1" = "plugin" ] && [ "$2" = "list" ] && [ "$3" = "--json" ]; then
  # No plugins installed
  echo "[]"
  exit 0
elif [ "$1" = "plugin" ] && [ "$2" = "install" ]; then
  echo "Installed: $3" >> "$HOME/installs.log"
  exit 0
fi
exit 0
EOF
  chmod +x "$TEMP_DIR/bin/claude"
  export PATH="$TEMP_DIR/bin:$PATH"

  # Create marketplace with a plugin
  mkdir -p "$CONFIG_DIR"
  cat > "$CONFIG_DIR/marketplace.json" << 'EOF'
{
  "name": "baleen-plugins",
  "plugins": [
    {
      "name": "git-guard",
      "version": "1.0.0",
      "source": "https://github.com/baleen37/claude-plugins"
    }
  ]
}
EOF

  export CLAUDE_PLUGIN_ROOT="$FIXTURES_DIR/../../.."
  export MARKETPLACE_FILE="$CONFIG_DIR/marketplace.json"

  # Run update-checker
  run "$SCRIPT_DIR/update-checker.sh" --silent
  [ "$status" -eq 0 ]

  # Should have installed the new plugin
  [ -f "$HOME/installs.log" ]
  run grep "git-guard@baleen-plugins" "$HOME/installs.log"
  [ "$status" -eq 0 ]
}
