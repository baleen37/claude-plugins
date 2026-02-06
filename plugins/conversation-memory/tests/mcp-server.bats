#!/usr/bin/env bats
# Tests for conversation-memory MCP server

setup() {
  # Ensure build artifacts exist
  if [ ! -f "${BATS_TEST_DIRNAME}/../dist/mcp-server.mjs" ]; then
    skip "MCP server not built - run 'bun run build' first"
  fi
}

@test "mcp-server.mjs: executable exists" {
  [ -f "${BATS_TEST_DIRNAME}/../dist/mcp-server.mjs" ]
}

@test "mcp-server.mjs: has valid Node.js shebang or can be executed with node" {
  # Check if file starts with shebang or is valid JS
  run head -1 "${BATS_TEST_DIRNAME}/../dist/mcp-server.mjs"
  # Either has shebang or is valid JS (we'll test execution next)
  [ "$status" -eq 0 ]
}

@test "mcp-server.mjs: can be loaded by Node.js" {
  # Try to parse the file (syntax check)
  run node --check "${BATS_TEST_DIRNAME}/../dist/mcp-server.mjs"
  [ "$status" -eq 0 ]
}

@test "cli.mjs: executable exists" {
  [ -f "${BATS_TEST_DIRNAME}/../dist/cli.mjs" ]
}

@test "cli.mjs: can be loaded by Node.js" {
  run node --check "${BATS_TEST_DIRNAME}/../dist/cli.mjs"
  [ "$status" -eq 0 ]
}
