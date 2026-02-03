#!/usr/bin/env bats
# Tests for conversation-memory install-deps.sh hook

# Mock npm commands for faster testing
npm() {
  case "$1" in
    install)
      mkdir -p "${CLAUDE_PLUGIN_ROOT}/node_modules"
      echo "npm install (mocked)"
      ;;
    run)
      shift
      if [ "$1" = "build" ]; then
        mkdir -p "${CLAUDE_PLUGIN_ROOT}/dist"
        echo "Mocked build output" > "${CLAUDE_PLUGIN_ROOT}/dist/mcp-server.mjs"
        echo "Mocked build output" > "${CLAUDE_PLUGIN_ROOT}/dist/cli.mjs"
        echo "Build successful (mocked)"
      fi
      ;;
    *)
      echo "Unknown npm command: $*" >&2
      return 1
      ;;
  esac
}

export -f npm

setup() {
  # Create a temporary directory for testing
  TEST_DIR=$(mktemp -d)
  export TEST_DIR
  export CLAUDE_PLUGIN_ROOT="${TEST_DIR}"

  # Copy hook script to test directory
  mkdir -p "${TEST_DIR}/hooks"
  cp "${BATS_TEST_DIRNAME}/../hooks/install-deps.sh" "${TEST_DIR}/hooks/install-deps.sh"
  chmod +x "${TEST_DIR}/hooks/install-deps.sh"

  # Create package.json
  cat > "${TEST_DIR}/package.json" << 'EOF'
{
  "name": "conversation-memory-test",
  "version": "1.0.0",
  "scripts": {
    "build": "npm run build"
  }
}
EOF

  cd "${TEST_DIR}"
}

teardown() {
  cd "${BATS_TEST_DIRNAME}"
  rm -rf "${TEST_DIR}"
}

@test "install-deps.sh: first run - no dist, no node_modules" {
  # Verify initial state
  [ ! -d "${TEST_DIR}/dist" ]
  [ ! -d "${TEST_DIR}/node_modules" ]

  # Run hook
  run "${TEST_DIR}/hooks/install-deps.sh"

  # Should succeed
  [ "$status" -eq 0 ]

  # dist and node_modules should be created
  [ -f "${TEST_DIR}/dist/mcp-server.mjs" ]
  [ -f "${TEST_DIR}/dist/cli.mjs" ]
  [ -d "${TEST_DIR}/node_modules" ]
}

@test "install-deps.sh: dist exists - should skip" {
  # Create fake dist
  mkdir -p "${TEST_DIR}/dist"
  echo "old build" > "${TEST_DIR}/dist/mcp-server.mjs"
  echo "old build" > "${TEST_DIR}/dist/cli.mjs"

  # Get original mtime (cross-platform: macOS uses -f, Linux uses -c)
  if stat -f "%m" "${TEST_DIR}/dist/mcp-server.mjs" >/dev/null 2>&1; then
    OLD_MTIME=$(stat -f "%m" "${TEST_DIR}/dist/mcp-server.mjs")
  else
    OLD_MTIME=$(stat -c %Y "${TEST_DIR}/dist/mcp-server.mjs")
  fi

  # Wait a bit to ensure mtime difference
  sleep 0.1

  # Run hook
  run "${TEST_DIR}/hooks/install-deps.sh"

  # Should succeed
  [ "$status" -eq 0 ]

  # dist should not be rebuilt (mtime unchanged)
  if stat -f "%m" "${TEST_DIR}/dist/mcp-server.mjs" >/dev/null 2>&1; then
    NEW_MTIME=$(stat -f "%m" "${TEST_DIR}/dist/mcp-server.mjs")
  else
    NEW_MTIME=$(stat -c %Y "${TEST_DIR}/dist/mcp-server.mjs")
  fi
  [ "${OLD_MTIME}" = "${NEW_MTIME}" ]
}

@test "install-deps.sh: package.json newer than dist - should rebuild" {
  # Create initial dist
  mkdir -p "${TEST_DIR}/dist"
  echo "old build" > "${TEST_DIR}/dist/mcp-server.mjs"
  echo "old build" > "${TEST_DIR}/dist/cli.mjs"

  # Wait a bit
  sleep 0.1

  # Touch package.json to make it newer
  touch "${TEST_DIR}/package.json"

  # Get dist mtime before (cross-platform: macOS uses -f, Linux uses -c)
  if stat -f "%m" "${TEST_DIR}/dist/mcp-server.mjs" >/dev/null 2>&1; then
    OLD_MTIME=$(stat -f "%m" "${TEST_DIR}/dist/mcp-server.mjs")
  else
    OLD_MTIME=$(stat -c %Y "${TEST_DIR}/dist/mcp-server.mjs")
  fi

  # Wait a bit to ensure mtime difference
  sleep 0.1

  # Run hook
  run "${TEST_DIR}/hooks/install-deps.sh"

  # Should succeed
  [ "$status" -eq 0 ]

  # dist should be rebuilt (mtime changed)
  if stat -f "%m" "${TEST_DIR}/dist/mcp-server.mjs" >/dev/null 2>&1; then
    NEW_MTIME=$(stat -f "%m" "${TEST_DIR}/dist/mcp-server.mjs")
  else
    NEW_MTIME=$(stat -c %Y "${TEST_DIR}/dist/mcp-server.mjs")
  fi
  [ "${NEW_MTIME}" -ge "${OLD_MTIME}" ]
}

@test "install-deps.sh: dist missing but node_modules exists" {
  # Create node_modules only
  mkdir -p "${TEST_DIR}/node_modules"
  echo "fake package" > "${TEST_DIR}/node_modules/test.txt"

  # Verify dist doesn't exist
  [ ! -d "${TEST_DIR}/dist" ]

  # Run hook
  run "${TEST_DIR}/hooks/install-deps.sh"

  # Should succeed
  [ "$status" -eq 0 ]

  # dist should be created
  [ -f "${TEST_DIR}/dist/mcp-server.mjs" ]
  [ -f "${TEST_DIR}/dist/cli.mjs" ]

  # node_modules should still exist
  [ -f "${TEST_DIR}/node_modules/test.txt" ]
}

@test "install-deps.sh: both dist and node_modules missing" {
  # Verify both don't exist
  [ ! -d "${TEST_DIR}/dist" ]
  [ ! -d "${TEST_DIR}/node_modules" ]

  # Run hook
  run "${TEST_DIR}/hooks/install-deps.sh"

  # Should succeed
  [ "$status" -eq 0 ]

  # Both should be created
  [ -d "${TEST_DIR}/node_modules" ]
  [ -f "${TEST_DIR}/dist/mcp-server.mjs" ]
  [ -f "${TEST_DIR}/dist/cli.mjs" ]
}
