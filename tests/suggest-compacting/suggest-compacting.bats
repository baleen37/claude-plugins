#!/usr/bin/env bats

setup() {
  # Setup test environment
  export TEST_SESSION_ID="test-session-123"
  export TEST_STATE_DIR="$HOME/.claude/suggest-compacting"
  export TEST_STATE_FILE="$TEST_STATE_DIR/tool-count-$TEST_SESSION_ID.txt"
  export CLAUDE_PLUGIN_ROOT="$PWD/plugins/suggest-compacting"

  # Clean up any existing test state
  rm -f "$TEST_STATE_FILE" 2>/dev/null || true
}

teardown() {
  # Clean up test state
  rm -f "$TEST_STATE_FILE" 2>/dev/null || true
}

@test "suggest-compacting: plugin.json exists" {
  [ -f "$CLAUDE_PLUGIN_ROOT/.claude-plugin/plugin.json" ]
}

@test "suggest-compacting: hooks.json exists" {
  [ -f "$CLAUDE_PLUGIN_ROOT/.claude-plugin/hooks.json" ]
}

@test "suggest-compacting: hooks.json has SessionStart hook" {
  run jq -e '.hooks.SessionStart' "$CLAUDE_PLUGIN_ROOT/.claude-plugin/hooks.json"
  [ "$status" -eq 0 ]
}

@test "suggest-compacting: hooks.json has PreToolUse hook" {
  run jq -e '.hooks.PreToolUse' "$CLAUDE_PLUGIN_ROOT/.claude-plugin/hooks.json"
  [ "$status" -eq 0 ]
}

@test "suggest-compacting: SessionStart hook uses tsx" {
  run jq -r '.hooks.SessionStart[0].hooks[0].command' "$CLAUDE_PLUGIN_ROOT/.claude-plugin/hooks.json"
  echo "$output" | grep -q "npx tsx"
  echo "$output" | grep -q "session-start.ts"
}

@test "suggest-compacting: PreToolUse hook uses tsx" {
  run jq -r '.hooks.PreToolUse[0].hooks[0].command' "$CLAUDE_PLUGIN_ROOT/.claude-plugin/hooks.json"
  echo "$output" | grep -q "npx tsx"
  echo "$output" | grep -q "auto-compact.ts"
}

@test "suggest-compacting: TypeScript source files exist" {
  [ -f "$CLAUDE_PLUGIN_ROOT/src/types/index.ts" ]
  [ -f "$CLAUDE_PLUGIN_ROOT/src/hooks/lib/state.ts" ]
  [ -f "$CLAUDE_PLUGIN_ROOT/src/hooks/session-start.ts" ]
  [ -f "$CLAUDE_PLUGIN_ROOT/src/hooks/auto-compact.ts" ]
}

@test "suggest-compacting: hooks are executable" {
  [ -x "$CLAUDE_PLUGIN_ROOT/src/hooks/session-start.ts" ]
  [ -x "$CLAUDE_PLUGIN_ROOT/src/hooks/auto-compact.ts" ]
}

@test "suggest-compacting: TypeScript config exists" {
  [ -f "$CLAUDE_PLUGIN_ROOT/tsconfig.json" ]
}

@test "suggest-compacting: Jest config exists" {
  [ -f "$CLAUDE_PLUGIN_ROOT/jest.config.cjs" ]
}

@test "suggest-compacting: unit tests exist" {
  [ -f "$CLAUDE_PLUGIN_ROOT/tests/unit/state.test.ts" ]
}

@test "suggest-compacting: old Bash hooks are removed" {
  [ ! -f "$CLAUDE_PLUGIN_ROOT/hooks/auto-compact.sh" ]
  [ ! -f "$CLAUDE_PLUGIN_ROOT/hooks/session-start-hook.sh" ]
  [ ! -f "$CLAUDE_PLUGIN_ROOT/hooks/lib/state.sh" ]
}

@test "suggest-compacting: auto-compact hook increments counter" {
  # Create temp input file
  local tmpinput
  tmpinput=$(mktemp)
  echo "{\"tool_name\":\"Read\",\"session_id\":\"$TEST_SESSION_ID\"}" > "$tmpinput"

  # Run the hook
  cat "$tmpinput" | npx tsx "$CLAUDE_PLUGIN_ROOT/src/hooks/auto-compact.ts" > /dev/null 2>&1
  rm -f "$tmpinput"

  # Check that state file was created
  [ -f "$TEST_STATE_FILE" ]

  # Check that counter was incremented
  local count
  count=$(cat "$TEST_STATE_FILE")
  [ "$count" -eq 1 ]
}

@test "suggest-compacting: auto-compact hook suggests at threshold" {
  # Set COMPACT_THRESHOLD to 3 for testing
  export COMPACT_THRESHOLD=3

  # Create temp input file
  local tmpinput
  tmpinput=$(mktemp)
  echo "{\"tool_name\":\"Read\",\"session_id\":\"$TEST_SESSION_ID\"}" > "$tmpinput"

  # Reset counter
  rm -f "$TEST_STATE_FILE"

  # Run the hook 2 times (count becomes 2)
  local i=1
  while [ $i -le 2 ]; do
    cat "$tmpinput" | npx tsx "$CLAUDE_PLUGIN_ROOT/src/hooks/auto-compact.ts" > /dev/null 2>&1
    i=$((i + 1))
  done

  # Third call should trigger suggestion (count == 3 == threshold)
  local output
  output=$(cat "$tmpinput" | npx tsx "$CLAUDE_PLUGIN_ROOT/src/hooks/auto-compact.ts" 2>&1)
  rm -f "$tmpinput"

  echo "$output" | grep -q "Suggestion"
  echo "$output" | grep -q "tool calls"
}

@test "suggest-compacting: session-start hook validates session ID" {
  # Create temp input files
  local tmpinput
  tmpinput=$(mktemp)
  local tmpinvalid
  tmpinvalid=$(mktemp)

  echo "{\"session_id\":\"valid-session-123\",\"transcript_path\":\"/tmp/test.json\"}" > "$tmpinput"
  echo "{\"session_id\":\"../../../etc/passwd\",\"transcript_path\":\"/tmp/test.json\"}" > "$tmpinvalid"

  # Test with valid session ID (no env file, should succeed silently)
  run bash -c "cat '$tmpinput' | npx tsx $CLAUDE_PLUGIN_ROOT/src/hooks/session-start.ts"
  [ "$status" -eq 0 ]

  # Test with invalid session ID (should fail)
  run bash -c "cat '$tmpinvalid' | npx tsx $CLAUDE_PLUGIN_ROOT/src/hooks/session-start.ts"
  [ "$status" -ne 0 ]

  rm -f "$tmpinput" "$tmpinvalid"
}

@test "suggest-compacting: package.json exists with correct scripts" {
  [ -f "$CLAUDE_PLUGIN_ROOT/package.json" ]

  run jq -r '.scripts.test' "$CLAUDE_PLUGIN_ROOT/package.json"
  [ "$output" = "jest" ]

  run jq -r '.scripts["test:watch"]' "$CLAUDE_PLUGIN_ROOT/package.json"
  [ "$output" = "jest --watch" ]
}
