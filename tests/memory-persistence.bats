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

@test "memory-persistence: extract_project_folder_from_transcript extracts project folder" {
  source "$PROJECT_ROOT/plugins/memory-persistence/scripts/lib/state.sh"

  # Valid project path
  local result
  result=$(extract_project_folder_from_transcript "/Users/test/.claude/projects/-Users-test-dev-project-a/abc123.jsonl")
  [ "$result" = "-Users-test-dev-project-a" ]

  # Different project
  result=$(extract_project_folder_from_transcript "/home/user/.claude/projects/my-cool-project/xyz789.jsonl")
  [ "$result" = "my-cool-project" ]

  # Empty transcript_path
  result=$(extract_project_folder_from_transcript "")
  [ -z "$result" ]

  # Null transcript_path
  result=$(extract_project_folder_from_transcript "null")
  [ -z "$result" ]

  # Non-project path (should return empty)
  result=$(extract_project_folder_from_transcript "/some/random/path/file.jsonl")
  [ -z "$result" ]
}

@test "memory-persistence: get_sessions_dir_for_project follows priority order" {
  source "$PROJECT_ROOT/plugins/memory-persistence/scripts/lib/state.sh"

  # Priority 1: Environment variable (highest)
  MEMORY_PERSISTENCE_SESSIONS_DIR="/tmp/override"
  run get_sessions_dir_for_project "/Users/test/.claude/projects/-Users-test-dev-project-a/abc.jsonl"
  [ "$output" = "/tmp/override" ]
  unset MEMORY_PERSISTENCE_SESSIONS_DIR

  # Priority 2: Project-specific directory
  run get_sessions_dir_for_project "/Users/test/.claude/projects/-Users-test-dev-project-a/abc.jsonl"
  [ "$output" = "$HOME/.claude/projects/-Users-test-dev-project-a" ]

  # Priority 3: Legacy fallback (no transcript_path)
  run get_sessions_dir_for_project ""
  [ "$output" = "$HOME/.claude/sessions" ]

  # Priority 3: Legacy fallback (invalid transcript_path)
  run get_sessions_dir_for_project "/some/random/path.jsonl"
  [ "$output" = "$HOME/.claude/sessions" ]
}

@test "memory-persistence: Stop hook saves to project-specific directory" {
  # Setup: Create temp directory structure
  local temp_home="$BATS_TMPDIR/home-$$"
  local project_folder="-Users-test-dev-project-a"
  local project_dir="$temp_home/.claude/projects/$project_folder"
  mkdir -p "$project_dir"

  # Create mock transcript
  local transcript="$project_dir/test-session-123.jsonl"
  echo '{"role": "user", "message": {"content": [{"type": "text", "text": "Hello"}]}}' > "$transcript"
  echo '{"role": "assistant", "message": {"content": [{"type": "text", "text": "Project-specific content"}]}}' >> "$transcript"

  # Run Stop hook WITHOUT environment variable override
  # (to test project-specific directory detection)
  echo "{\"session_id\": \"test-123\", \"transcript_path\": \"$transcript\"}" | \
    HOME="$temp_home" \
    bash "$PROJECT_ROOT/plugins/memory-persistence/hooks/stop-hook.sh"

  # Verify session file was created in project directory
  run ls "$project_dir"/session-test-123-*.md
  [ $status -eq 0 ]

  # Verify content
  local session_file
  session_file=$(ls "$project_dir"/session-test-123-*.md | head -1)
  grep -q "Project-specific content" "$session_file"

  # Cleanup
  rm -rf "$temp_home"
}

@test "memory-persistence: SessionStart hook loads from project-specific directory only" {
  # Setup: Create temp directory structure with two projects
  local temp_home="$BATS_TMPDIR/home-$$"
  local project_a_folder="-Users-test-dev-project-a"
  local project_b_folder="-Users-test-dev-project-b"
  local project_a_dir="$temp_home/.claude/projects/$project_a_folder"
  local project_b_dir="$temp_home/.claude/projects/$project_b_folder"
  mkdir -p "$project_a_dir" "$project_b_dir"

  # Create session files in both projects
  echo "# Session A content" > "$project_a_dir/session-a-123-20260101-120000.md"
  echo "# Session B content" > "$project_b_dir/session-b-456-20260101-130000.md"

  # Create transcript for project A
  local transcript_a="$project_a_dir/current-session.jsonl"
  echo '{}' > "$transcript_a"

  # Run SessionStart hook for project A
  local output
  output=$(echo "{\"session_id\": \"current-123\", \"transcript_path\": \"$transcript_a\"}" | \
    HOME="$temp_home" \
    bash "$PROJECT_ROOT/plugins/memory-persistence/hooks/session-start-hook.sh")

  # Verify: Should load project A session only
  [[ "$output" =~ "Session A content" ]]

  # Verify: Should NOT load project B session
  ! [[ "$output" =~ "Session B content" ]]

  # Cleanup
  rm -rf "$temp_home"
}

@test "memory-persistence: marketplace.json includes memory-persistence" {
  local plugin
  plugin=$(jq -r '.plugins[] | select(.name == "memory-persistence")' "$MARKETPLACE_JSON")
  [ -n "$plugin" ]

  local version
  version=$(echo "$plugin" | jq -r '.version')
  # Check version matches plugin.json
  local expected_version
  expected_version=$(jq -r ".version" "$PROJECT_ROOT/plugins/memory-persistence/.claude-plugin/plugin.json")
  [ "$version" = "$expected_version" ]
}
