#!/usr/bin/env bats
# Memory Persistence Plugin Tests

load helpers/bats_helper
load helpers/fixture_factory

# Set up paths - use current directory for worktree support
PROJECT_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
MARKETPLACE_JSON="${PROJECT_ROOT}/.claude-plugin/marketplace.json"

@test "memory-persistence: plugin directory structure exists" {
  [ -d "$PROJECT_ROOT/plugins/memory-persistence" ]
  [ -d "$PROJECT_ROOT/plugins/memory-persistence/.claude-plugin" ]
  [ -d "$PROJECT_ROOT/plugins/memory-persistence/hooks" ]
  [ -d "$PROJECT_ROOT/plugins/memory-persistence/scripts/lib" ]
}

@test "memory-persistence: plugin.json is valid" {
  [ -f "$PROJECT_ROOT/plugins/memory-persistence/.claude-plugin/plugin.json" ]
  jq empty "$PROJECT_ROOT/plugins/memory-persistence/.claude-plugin/plugin.json"
}

@test "memory-persistence: hooks.json is valid" {
  [ -f "$PROJECT_ROOT/plugins/memory-persistence/hooks/hooks.json" ]
  jq empty "$PROJECT_ROOT/plugins/memory-persistence/hooks/hooks.json"
}

@test "memory-persistence: stop-hook.sh is executable" {
  [ -x "$PROJECT_ROOT/plugins/memory-persistence/hooks/stop-hook.sh" ]
}

@test "memory-persistence: session-start-hook.sh is executable" {
  [ -x "$PROJECT_ROOT/plugins/memory-persistence/hooks/session-start-hook.sh" ]
}

@test "memory-persistence: state library validates session IDs" {
  source "$PROJECT_ROOT/plugins/memory-persistence/scripts/lib/state.sh"

  # Valid session IDs
  validate_session_id "abc123"
  validate_session_id "test-session-123"

  # Invalid session IDs
  run validate_session_id "invalid session"
  [ $status -eq 1 ]

  run validate_session_id "session/with/slashes"
  [ $status -eq 1 ]
}

@test "memory-persistence: get_sessions_dir respects environment variable" {
  source "$PROJECT_ROOT/plugins/memory-persistence/scripts/lib/state.sh"

  # Test default
  MEMORY_PERSISTENCE_SESSIONS_DIR="" \
    get_sessions_dir | grep "$HOME/.claude/sessions"

  # Test override
  MEMORY_PERSISTENCE_SESSIONS_DIR="/tmp/test-sessions" \
    get_sessions_dir | grep "/tmp/test-sessions"
}

@test "memory-persistence: Stop hook saves session file from transcript" {
  # Setup: Create temp sessions directory and transcript
  local temp_sessions="$BATS_TMPDIR/sessions-test-$$"
  mkdir -p "$temp_sessions"

  # Create mock transcript (JSONL format)
  # NOTE: JSONL format verified from ralph-loop stop-hook.sh lines 101-106:
  # .message.content is an array of {type: "text", text: "..."}
  local transcript="$BATS_TMPDIR/transcript-$$.jsonl"
  echo '{"role": "user", "message": {"content": [{"type": "text", "text": "Hello"}]}}' > "$transcript"
  echo '{"role": "assistant", "message": {"content": [{"type": "text", "text": "Hi there! This is test content."}]}}' >> "$transcript"

  # Run Stop hook with test input
  echo "{\"session_id\": \"test-123\", \"transcript_path\": \"$transcript\"}" | \
    MEMORY_PERSISTENCE_SESSIONS_DIR="$temp_sessions" \
    bash "$PROJECT_ROOT/plugins/memory-persistence/hooks/stop-hook.sh"

  # Verify session file was created
  run ls "$temp_sessions"/session-test-123-*.md
  [ $status -eq 0 ]

  # Verify session file contains the conversation
  local session_file
  session_file=$(ls "$temp_sessions"/session-test-123-*.md | head -1)
  grep -q "Hi there! This is test content." "$session_file"

  # Cleanup
  rm -rf "$temp_sessions"
  rm -f "$transcript"
}

@test "memory-persistence: marketplace.json includes memory-persistence" {
  local plugin
  plugin=$(jq -r '.plugins[] | select(.name == "memory-persistence")' "$MARKETPLACE_JSON")
  [ -n "$plugin" ]

  local version
  version=$(echo "$plugin" | jq -r '.version')
  [ "$version" = "1.0.0" ]
}
