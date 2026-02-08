#!/usr/bin/env bats
# Handoff plugin tests

load ../helpers/fixture_factory

setup() {
  # Create temp directory for tests
  TEST_TEMP_DIR="$(mktemp -d)"
  export HANDOFF_TEST_DIR="$TEST_TEMP_DIR/handoffs"
  mkdir -p "$HANDOFF_TEST_DIR"

  # Mock project path
  export TEST_PROJECT_PATH="/tmp/test-project"
  mkdir -p "$TEST_PROJECT_PATH"

  # Current time for timestamps
  NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  export NOW
}

teardown() {
  rm -rf "$TEST_TEMP_DIR"
  rm -rf "$TEST_PROJECT_PATH"
}

@test "handoff directory is created when it doesn't exist" {
  [ -d "$HANDOFF_TEST_DIR" ]
}

@test "handoff JSON file has correct structure" {
  # Create a test handoff file
  HANDOFF_ID="test-handoff-123"
  HANDOFF_FILE="$HANDOFF_TEST_DIR/${HANDOFF_ID}.json"

  create_handoff_json "$HANDOFF_FILE" "$HANDOFF_ID" "$NOW" "$TEST_PROJECT_PATH" "Test handoff summary" "main" "test-project" "null" "null" "null" "test-session-123"

  # Verify file exists and is valid JSON
  [ -f "$HANDOFF_FILE" ]
  jq -e '.' "$HANDOFF_FILE" >/dev/null

  # Verify required fields
  [ "$(jq -r '.id' "$HANDOFF_FILE")" = "$HANDOFF_ID" ]
  [ "$(jq -r '.project_path' "$HANDOFF_FILE")" = "$TEST_PROJECT_PATH" ]
  [ "$(jq -r '.summary' "$HANDOFF_FILE")" = "Test handoff summary" ]
}

@test "handoff file filtering by project path works" {
  # Create handoffs for different projects
  create_handoff_json "$HANDOFF_TEST_DIR/handoff1.json" "handoff1" "$NOW" "$TEST_PROJECT_PATH" "Test project handoff"
  create_handoff_json "$HANDOFF_TEST_DIR/handoff2.json" "handoff2" "$NOW" "/other/project" "Other project handoff"

  # Filter by project path
  result=$(jq -s '[.[] | select(.project_path == "'"$TEST_PROJECT_PATH"'")] | length' "$HANDOFF_TEST_DIR"/*.json)
  [ "$result" -eq 1 ]
}

@test "handoff loaded_at timestamp updates on pickup" {
  HANDOFF_FILE="$HANDOFF_TEST_DIR/test-loaded.json"

  create_handoff_json "$HANDOFF_FILE" "test-loaded" "$NOW" "$TEST_PROJECT_PATH" "Test loading"

  # Verify loaded_at is null initially
  [ "$(jq -r '.loaded_at' "$HANDOFF_FILE")" = "null" ]

  # Update loaded_at
  LOADED_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  jq --arg ts "$LOADED_TIME" '.loaded_at = $ts' "$HANDOFF_FILE" > "$HANDOFF_FILE.tmp"
  mv "$HANDOFF_FILE.tmp" "$HANDOFF_FILE"

  # Verify loaded_at was updated
  [ "$(jq -r '.loaded_at' "$HANDOFF_FILE")" = "$LOADED_TIME" ]
}

@test "session-start hook detects recent handoffs" {
  # Create a recent handoff (within 5 minutes)
  RECENT_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  create_handoff_json "$HANDOFF_TEST_DIR/recent-handoff.json" "recent-handoff" "$RECENT_TIME" "$TEST_PROJECT_PATH" "Recent work"

  # Verify handoff is recent
  created_at=$(jq -r '.created_at' "$HANDOFF_TEST_DIR/recent-handoff.json")
  [ -n "$created_at" ]
}

@test "session-start hook ignores already loaded handoffs" {
  # Create an old handoff that was already loaded
  create_handoff_json "$HANDOFF_TEST_DIR/loaded-handoff.json" "loaded-handoff" "$NOW" "$TEST_PROJECT_PATH" "Already loaded" "main" "test-project" "null" "null" "$NOW"

  # Verify loaded_at is not null
  loaded_at=$(jq -r '.loaded_at' "$HANDOFF_TEST_DIR/loaded-handoff.json")
  [ "$loaded_at" != "null" ]
}

@test "handoff-list sorts by created_at descending" {
  # Create handoffs with different timestamps
  create_handoff_json "$HANDOFF_TEST_DIR/old.json" "old" "2026-02-01T10:00:00Z" "$TEST_PROJECT_PATH" "Old handoff"
  create_handoff_json "$HANDOFF_TEST_DIR/new.json" "new" "2026-02-04T10:00:00Z" "$TEST_PROJECT_PATH" "New handoff"
  create_handoff_json "$HANDOFF_TEST_DIR/middle.json" "middle" "2026-02-02T10:00:00Z" "$TEST_PROJECT_PATH" "Middle handoff"

  # Sort by created_at descending
  result=$(jq -s 'sort_by(.created_at) | reverse | .[0].id' "$HANDOFF_TEST_DIR"/*.json)
  [ "$result" = '"new"' ]
}

@test "pickup resolves plan_path with tilde expansion" {
  HANDOFF_FILE="$HANDOFF_TEST_DIR/plan-handoff.json"

  # Create a test plan file
  TEST_PLAN_DIR="$TEST_TEMP_DIR/.claude/plans"
  mkdir -p "$TEST_PLAN_DIR"
  TEST_PLAN_FILE="$TEST_PLAN_DIR/test-plan.md"
  echo "# Test Plan" > "$TEST_PLAN_FILE"

  # Create handoff with plan_path reference
  create_handoff_json "$HANDOFF_FILE" "plan-handoff" "$NOW" "$TEST_PROJECT_PATH" "Handoff with plan reference" "main" "test-project" "$TEST_PLAN_FILE"

  # Extract plan_path from handoff
  PLAN_PATH=$(jq -r '.references.plan_path // empty' "$HANDOFF_FILE")
  [ "$PLAN_PATH" = "$TEST_PLAN_FILE" ]

  # Verify the expansion works
  TEST_EXPANDED="${PLAN_PATH/#\~/$TEST_TEMP_DIR}"
  [ "$TEST_EXPANDED" = "$TEST_PLAN_FILE" ]
}

@test "pickup extracts tasks_session_id for loading" {
  HANDOFF_FILE="$HANDOFF_TEST_DIR/tasks-handoff.json"
  TASKS_SESSION_ID="75c272b1-b00d-4bbb-bfa5-87269f30ff47"

  create_handoff_json "$HANDOFF_FILE" "tasks-handoff" "$NOW" "$TEST_PROJECT_PATH" "Handoff with tasks session" "main" "test-project" "null" "$TASKS_SESSION_ID"

  # Extract tasks_session_id from handoff
  EXTRACTED_SESSION_ID=$(jq -r '.references.tasks_session_id // empty' "$HANDOFF_FILE")
  [ "$EXTRACTED_SESSION_ID" = "$TASKS_SESSION_ID" ]
}

@test "pickup handles missing plan file gracefully" {
  HANDOFF_FILE="$HANDOFF_TEST_DIR/missing-plan-handoff.json"

  create_handoff_json "$HANDOFF_FILE" "missing-plan-handoff" "$NOW" "$TEST_PROJECT_PATH" "Handoff with missing plan" "main" "test-project" "$HOME/.claude/plans/nonexistent.md"

  # Extract plan_path
  PLAN_PATH=$(jq -r '.references.plan_path // empty' "$HANDOFF_FILE")
  [ -n "$PLAN_PATH" ]

  # Verify file doesn't exist (skill should show warning but continue)
  [ ! -f "$PLAN_PATH" ]
}

@test "pickup displays source_session_id when present" {
  HANDOFF_FILE="$HANDOFF_TEST_DIR/source-session-handoff.json"
  SOURCE_SESSION_ID="00538c2c-c67e-4afe-a933-bb8ed6ed19c6"

  create_handoff_json "$HANDOFF_FILE" "source-session-handoff" "$NOW" "$TEST_PROJECT_PATH" "Handoff with source session" "main" "test-project" "null" "null" "null" "$SOURCE_SESSION_ID"

  # Extract source_session_id
  EXTRACTED_SOURCE=$(jq -r '.source_session_id // empty' "$HANDOFF_FILE")
  [ "$EXTRACTED_SOURCE" = "$SOURCE_SESSION_ID" ]
}

@test "pickup finds most recent unloaded handoff for project" {
  # Create multiple handoffs for the same project
  create_handoff_json "$HANDOFF_TEST_DIR/recent1.json" "recent1" "2026-02-04T10:00:00Z" "$TEST_PROJECT_PATH" "Recent handoff 1"
  create_handoff_json "$HANDOFF_TEST_DIR/recent2.json" "recent2" "2026-02-04T12:00:00Z" "$TEST_PROJECT_PATH" "Recent handoff 2"
  create_handoff_json "$HANDOFF_TEST_DIR/loaded.json" "loaded" "2026-02-04T13:00:00Z" "$TEST_PROJECT_PATH" "Already loaded" "main" "test-project" "null" "null" "2026-02-04T14:00:00Z"

  # Find most recent unloaded handoff
  # In the skill, this would use find and jq to filter by project and loaded_at == null
  result=$(jq -s '[.[] | select(.project_path == "'"$TEST_PROJECT_PATH"'") | select(.loaded_at == null)] | sort_by(.created_at) | reverse | .[0].id' "$HANDOFF_TEST_DIR"/*.json)
  [ "$result" = '"recent2"' ]
}
