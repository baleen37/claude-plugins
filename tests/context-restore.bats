#!/usr/bin/env bats
# Context Restore Plugin Tests

load helpers/bats_helper
load helpers/fixture_factory

# Set up paths - use current directory for worktree support
PROJECT_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
MARKETPLACE_JSON="${PROJECT_ROOT}/.claude-plugin/marketplace.json"

@test "context-restore: plugin directory structure exists" {
  [ -d "$PROJECT_ROOT/plugins/context-restore" ]
  [ -d "$PROJECT_ROOT/plugins/context-restore/.claude-plugin" ]
  [ -d "$PROJECT_ROOT/plugins/context-restore/hooks" ]
  [ -d "$PROJECT_ROOT/plugins/context-restore/scripts/lib" ]
}

@test "context-restore: plugin.json is valid" {
  [ -f "$PROJECT_ROOT/plugins/context-restore/.claude-plugin/plugin.json" ]
  jq empty "$PROJECT_ROOT/plugins/context-restore/.claude-plugin/plugin.json"
}

@test "context-restore: hooks.json is valid" {
  [ -f "$PROJECT_ROOT/plugins/context-restore/hooks/hooks.json" ]
  jq empty "$PROJECT_ROOT/plugins/context-restore/hooks/hooks.json"
}

@test "context-restore: stop-hook.sh is executable" {
  [ -x "$PROJECT_ROOT/plugins/context-restore/hooks/stop-hook.sh" ]
}

@test "context-restore: session-start-hook.sh is executable" {
  [ -x "$PROJECT_ROOT/plugins/context-restore/hooks/session-start-hook.sh" ]
}

@test "context-restore: state library validates session IDs" {
  source "$PROJECT_ROOT/plugins/context-restore/scripts/lib/state.sh"

  # Valid session IDs
  validate_session_id "abc123"
  validate_session_id "test-session-123"

  # Invalid session IDs
  run validate_session_id "invalid session"
  [ $status -eq 1 ]

  run validate_session_id "session/with/slashes"
  [ $status -eq 1 ]
}

@test "context-restore: get_sessions_dir respects environment variable" {
  source "$PROJECT_ROOT/plugins/context-restore/scripts/lib/state.sh"

  # Test default
  CONTEXT_RESTORE_SESSIONS_DIR="" \
    get_sessions_dir | grep "$HOME/.claude/sessions"

  # Test override
  CONTEXT_RESTORE_SESSIONS_DIR="/tmp/test-sessions" \
    get_sessions_dir | grep "/tmp/test-sessions"
}

@test "context-restore: Stop hook saves session file from transcript" {
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
    CONTEXT_RESTORE_SESSIONS_DIR="$temp_sessions" \
    bash "$PROJECT_ROOT/plugins/context-restore/hooks/stop-hook.sh"

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

@test "context-restore: extract_project_folder_from_transcript extracts project folder" {
  source "$PROJECT_ROOT/plugins/context-restore/scripts/lib/state.sh"

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

@test "context-restore: get_sessions_dir_for_project follows priority order" {
  source "$PROJECT_ROOT/plugins/context-restore/scripts/lib/state.sh"

  # Priority 1: Environment variable (highest)
  CONTEXT_RESTORE_SESSIONS_DIR="/tmp/override"
  run get_sessions_dir_for_project "/Users/test/.claude/projects/-Users-test-dev-project-a/abc.jsonl"
  [ "$output" = "/tmp/override" ]
  unset CONTEXT_RESTORE_SESSIONS_DIR

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

@test "context-restore: Stop hook saves to project-specific directory" {
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
    bash "$PROJECT_ROOT/plugins/context-restore/hooks/stop-hook.sh"

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

@test "context-restore: SessionStart hook loads from project-specific directory only" {
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
    bash "$PROJECT_ROOT/plugins/context-restore/hooks/session-start-hook.sh")

  # Verify: Should load project A session only
  [[ "$output" =~ "Session A content" ]]

  # Verify: Should NOT load project B session
  ! [[ "$output" =~ "Session B content" ]]

  # Cleanup
  rm -rf "$temp_home"
}

@test "context-restore: marketplace.json includes context-restore" {
  local plugin
  plugin=$(jq -r '.plugins[] | select(.name == "context-restore")' "$MARKETPLACE_JSON")
  [ -n "$plugin" ]

  local version
  version=$(echo "$plugin" | jq -r '.version')
  # Check version matches plugin.json
  local expected_version
  expected_version=$(jq -r ".version" "$PROJECT_ROOT/plugins/context-restore/.claude-plugin/plugin.json")
  [ "$version" = "$expected_version" ]
}

@test "context-restore: has_compact_command detects /compact in transcript" {
  source "$PROJECT_ROOT/plugins/context-restore/scripts/lib/state.sh"

  # Create test transcript with /compact command
  local transcript="$BATS_TMPDIR/transcript-with-compact-$$.jsonl"
  echo '{"role": "user", "message": {"content": [{"type": "text", "text": "<command-name>/compact</command-name>"}]}}' > "$transcript"

  # Should return 0 (found)
  run has_compact_command "$transcript"
  [ $status -eq 0 ]

  # Create test transcript without /compact
  local transcript_no_compact="$BATS_TMPDIR/transcript-no-compact-$$.jsonl"
  echo '{"role": "user", "message": {"content": [{"type": "text", "text": "Hello"}]}}' > "$transcript_no_compact"

  # Should return 1 (not found)
  run has_compact_command "$transcript_no_compact"
  [ $status -eq 1 ]

  # Cleanup
  rm -f "$transcript" "$transcript_no_compact"
}

@test "context-restore: extract_transcript_path_from_session extracts path" {
  source "$PROJECT_ROOT/plugins/context-restore/scripts/lib/state.sh"

  # Create test session file
  local session_file="$BATS_TMPDIR/session-test-$$.md"
  cat > "$session_file" <<EOF
# Session: test-123
# Date: 2026-02-02 14:30:00

## Last Assistant Message

Test content

## Session Metadata

- Session ID: test-123
- End Time: 2026-02-02 14:30:00
- Transcript: /path/to/transcript.jsonl
- Saved by: context-restore plugin
EOF

  local result
  result=$(extract_transcript_path_from_session "$session_file")
  [ "$result" = "/path/to/transcript.jsonl" ]

  # Cleanup
  rm -f "$session_file"
}

@test "context-restore: extract_timestamp_from_session extracts timestamp" {
  source "$PROJECT_ROOT/plugins/context-restore/scripts/lib/state.sh"

  # Test Priority 1: End Time
  local session_file="$BATS_TMPDIR/session-test-$$.md"
  cat > "$session_file" <<EOF
# Session: test-123
# Date: 2026-02-02 14:30:00

## Last Assistant Message

Test content

## Session Metadata

- Session ID: test-123
- End Time: 2026-02-02 14:30:00
- Transcript: /path/to/transcript.jsonl
EOF

  local result
  result=$(extract_timestamp_from_session "$session_file")
  [ "$result" = "2026-02-02 14:30:00" ]

  # Test Priority 2: Date line (fallback)
  cat > "$session_file" <<EOF
# Session: test-123
# Date: 2026-02-02 15:45:00

## Last Assistant Message

Test content
EOF

  result=$(extract_timestamp_from_session "$session_file")
  [ "$result" = "2026-02-02 15:45:00" ]

  # Cleanup
  rm -f "$session_file"
}

@test "context-restore: find_most_recent_compact_session finds compact timestamp" {
  source "$PROJECT_ROOT/plugins/context-restore/scripts/lib/state.sh"

  # Setup: Create temp sessions directory
  local temp_sessions="$BATS_TMPDIR/sessions-compact-test-$$"
  local temp_project="$BATS_TMPDIR/project-$$"
  mkdir -p "$temp_sessions" "$temp_project"

  # Create 3 sessions without /compact
  for i in 1 2; do
    local transcript="$temp_project/transcript-$i.jsonl"
    echo '{"role": "user", "message": {"content": [{"type": "text", "text": "Hello"}]}}' > "$transcript"

    local session_file="$temp_sessions/session-test-$i-2026010${i}-120000.md"
    cat > "$session_file" <<EOF
# Session: test-$i
# Date: 2026-01-0${i} 12:00:00

## Session Metadata
- End Time: 2026-01-0${i} 12:00:00
- Transcript: $transcript
EOF
  done

  # Create 1 session with /compact
  local transcript_compact="$temp_project/transcript-3.jsonl"
  echo '{"role": "user", "message": {"content": [{"type": "text", "text": "<command-name>/compact</command-name>"}]}}' > "$transcript_compact"

  local session_compact="$temp_sessions/session-test-3-20260103-120000.md"
  cat > "$session_compact" <<EOF
# Session: test-3
# Date: 2026-01-03 12:00:00

## Session Metadata
- End Time: 2026-01-03 12:00:00
- Transcript: $transcript_compact
EOF

  # Create 2 more sessions after /compact
  for i in 4 5; do
    local transcript="$temp_project/transcript-$i.jsonl"
    echo '{"role": "user", "message": {"content": [{"type": "text", "text": "After compact"}]}}' > "$transcript"

    local session_file="$temp_sessions/session-test-$i-2026010${i}-120000.md"
    cat > "$session_file" <<EOF
# Session: test-$i
# Date: 2026-01-0${i} 12:00:00

## Session Metadata
- End Time: 2026-01-0${i} 12:00:00
- Transcript: $transcript
EOF
  done

  # Test: Should find the compact session timestamp
  local result
  result=$(find_most_recent_compact_session "$temp_sessions")
  [ "$result" = "2026-01-03 12:00:00" ]

  # Cleanup
  rm -rf "$temp_sessions" "$temp_project"
}

@test "context-restore: find_recent_sessions_after_compact filters sessions correctly" {
  source "$PROJECT_ROOT/plugins/context-restore/scripts/lib/state.sh"

  # Setup: Create temp directory structure
  local temp_home="$BATS_TMPDIR/home-compact-filter-$$"
  local project_folder="-Users-test-dev-project-filter"
  local project_dir="$temp_home/.claude/projects/$project_folder"
  mkdir -p "$project_dir"

  # Create 3 sessions before /compact
  for i in 1 2 3; do
    local transcript="$project_dir/transcript-$i.jsonl"
    echo '{"role": "user", "message": {"content": [{"type": "text", "text": "Before compact"}]}}' > "$transcript"

    local session_file="$project_dir/session-before-$i-2026010${i}-120000.md"
    cat > "$session_file" <<EOF
# Session: before-$i
# Date: 2026-01-0${i} 12:00:00

## Last Assistant Message
Before compact content $i

## Session Metadata
- End Time: 2026-01-0${i} 12:00:00
- Transcript: $transcript
EOF
  done

  # Create /compact session
  local transcript_compact="$project_dir/transcript-compact.jsonl"
  echo '{"role": "user", "message": {"content": [{"type": "text", "text": "<command-name>/compact</command-name>"}]}}' > "$transcript_compact"

  local session_compact="$project_dir/session-compact-20260104-120000.md"
  cat > "$session_compact" <<EOF
# Session: compact
# Date: 2026-01-04 12:00:00

## Session Metadata
- End Time: 2026-01-04 12:00:00
- Transcript: $transcript_compact
EOF

  # Create 2 sessions after /compact
  for i in 5 6; do
    local transcript="$project_dir/transcript-$i.jsonl"
    echo '{"role": "user", "message": {"content": [{"type": "text", "text": "After compact"}]}}' > "$transcript"

    local session_file="$project_dir/session-after-$i-2026010${i}-120000.md"
    cat > "$session_file" <<EOF
# Session: after-$i
# Date: 2026-01-0${i} 12:00:00

## Last Assistant Message
After compact content $i

## Session Metadata
- End Time: 2026-01-0${i} 12:00:00
- Transcript: $transcript
EOF
  done

  # Test: Should return only sessions after /compact
  local test_transcript="$project_dir/current.jsonl"
  echo '{}' > "$test_transcript"

  local output
  output=$(HOME="$temp_home" find_recent_sessions_after_compact 5 "$test_transcript")

  # Should include "after" sessions
  [[ "$output" =~ "session-after-6" ]]
  [[ "$output" =~ "session-after-5" ]]

  # Should NOT include "before" or "compact" sessions
  ! [[ "$output" =~ "session-before" ]]
  ! [[ "$output" =~ "session-compact" ]]

  # Cleanup
  rm -rf "$temp_home"
}

@test "context-restore: find_recent_sessions_after_compact returns all when no compact" {
  source "$PROJECT_ROOT/plugins/context-restore/scripts/lib/state.sh"

  # Setup: Create temp directory without /compact sessions
  local temp_home="$BATS_TMPDIR/home-no-compact-$$"
  local project_folder="-Users-test-dev-project-nocompact"
  local project_dir="$temp_home/.claude/projects/$project_folder"
  mkdir -p "$project_dir"

  # Create 5 sessions without /compact
  for i in 1 2 3 4 5; do
    local transcript="$project_dir/transcript-$i.jsonl"
    echo '{"role": "user", "message": {"content": [{"type": "text", "text": "No compact"}]}}' > "$transcript"

    local session_file="$project_dir/session-normal-$i-2026010${i}-120000.md"
    cat > "$session_file" <<EOF
# Session: normal-$i
# Date: 2026-01-0${i} 12:00:00

## Session Metadata
- End Time: 2026-01-0${i} 12:00:00
- Transcript: $transcript
EOF
  done

  # Test: Should return all 5 sessions (current behavior maintained)
  local test_transcript="$project_dir/current.jsonl"
  echo '{}' > "$test_transcript"

  local output
  output=$(HOME="$temp_home" find_recent_sessions_after_compact 5 "$test_transcript")

  # Count returned sessions
  local count
  count=$(echo "$output" | grep -c "session-normal" || true)
  [ "$count" -eq 5 ]

  # Cleanup
  rm -rf "$temp_home"
}
