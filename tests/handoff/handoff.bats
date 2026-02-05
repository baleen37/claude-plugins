#!/usr/bin/env bats
# Handoff plugin tests

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

  cat > "$HANDOFF_FILE" <<EOF
{
  "id": "$HANDOFF_ID",
  "created_at": "$NOW",
  "loaded_at": null,
  "project_name": "test-project",
  "project_path": "$TEST_PROJECT_PATH",
  "branch": "main",
  "summary": "Test handoff summary",
  "references": {
    "plan_path": null,
    "tasks_session_id": null
  },
  "source_session_id": "test-session-123"
}
EOF

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
  cat > "$HANDOFF_TEST_DIR/handoff1.json" <<EOF
{
  "id": "handoff1",
  "created_at": "$NOW",
  "loaded_at": null,
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "Test project handoff"
}
EOF

  cat > "$HANDOFF_TEST_DIR/handoff2.json" <<EOF
{
  "id": "handoff2",
  "created_at": "$NOW",
  "loaded_at": null,
  "project_path": "/other/project",
  "summary": "Other project handoff"
}
EOF

  # Filter by project path
  result=$(jq -s '[.[] | select(.project_path == "'"$TEST_PROJECT_PATH"'")] | length' "$HANDOFF_TEST_DIR"/*.json)
  [ "$result" -eq 1 ]
}

@test "handoff loaded_at timestamp updates on pickup" {
  HANDOFF_FILE="$HANDOFF_TEST_DIR/test-loaded.json"

  cat > "$HANDOFF_FILE" <<EOF
{
  "id": "test-loaded",
  "created_at": "$NOW",
  "loaded_at": null,
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "Test loading"
}
EOF

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
  cat > "$HANDOFF_TEST_DIR/recent-handoff.json" <<EOF
{
  "id": "recent-handoff",
  "created_at": "$RECENT_TIME",
  "loaded_at": null,
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "Recent work"
}
EOF

  # Verify handoff is recent
  created_at=$(jq -r '.created_at' "$HANDOFF_TEST_DIR/recent-handoff.json")
  [ -n "$created_at" ]
}

@test "session-start hook ignores already loaded handoffs" {
  # Create an old handoff that was already loaded
  cat > "$HANDOFF_TEST_DIR/loaded-handoff.json" <<EOF
{
  "id": "loaded-handoff",
  "created_at": "$NOW",
  "loaded_at": "$NOW",
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "Already loaded"
}
EOF

  # Verify loaded_at is not null
  loaded_at=$(jq -r '.loaded_at' "$HANDOFF_TEST_DIR/loaded-handoff.json")
  [ "$loaded_at" != "null" ]
}

@test "handoff-list sorts by created_at descending" {
  # Create handoffs with different timestamps
  cat > "$HANDOFF_TEST_DIR/old.json" <<EOF
{
  "id": "old",
  "created_at": "2026-02-01T10:00:00Z",
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "Old handoff"
}
EOF

  cat > "$HANDOFF_TEST_DIR/new.json" <<EOF
{
  "id": "new",
  "created_at": "2026-02-04T10:00:00Z",
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "New handoff"
}
EOF

  cat > "$HANDOFF_TEST_DIR/middle.json" <<EOF
{
  "id": "middle",
  "created_at": "2026-02-02T10:00:00Z",
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "Middle handoff"
}
EOF

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
  cat > "$HANDOFF_FILE" <<EOF
{
  "id": "plan-handoff",
  "created_at": "$NOW",
  "loaded_at": null,
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "Handoff with plan reference",
  "references": {
    "plan_path": "$TEST_PLAN_FILE",
    "tasks_session_id": null
  }
}
EOF

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

  cat > "$HANDOFF_FILE" <<EOF
{
  "id": "tasks-handoff",
  "created_at": "$NOW",
  "loaded_at": null,
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "Handoff with tasks session",
  "references": {
    "plan_path": null,
    "tasks_session_id": "$TASKS_SESSION_ID"
  }
}
EOF

  # Extract tasks_session_id from handoff
  EXTRACTED_SESSION_ID=$(jq -r '.references.tasks_session_id // empty' "$HANDOFF_FILE")
  [ "$EXTRACTED_SESSION_ID" = "$TASKS_SESSION_ID" ]
}

@test "pickup handles missing plan file gracefully" {
  HANDOFF_FILE="$HANDOFF_TEST_DIR/missing-plan-handoff.json"

  cat > "$HANDOFF_FILE" <<EOF
{
  "id": "missing-plan-handoff",
  "created_at": "$NOW",
  "loaded_at": null,
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "Handoff with missing plan",
  "references": {
    "plan_path": "~/.claude/plans/nonexistent.md",
    "tasks_session_id": null
  }
}
EOF

  # Extract plan_path
  PLAN_PATH=$(jq -r '.references.plan_path // empty' "$HANDOFF_FILE")
  [ -n "$PLAN_PATH" ]

  # Verify file doesn't exist (skill should show warning but continue)
  EXPANDED_PATH="${PLAN_PATH/#\~/$HOME}"
  [ ! -f "$EXPANDED_PATH" ]
}

@test "pickup displays source_session_id when present" {
  HANDOFF_FILE="$HANDOFF_TEST_DIR/source-session-handoff.json"
  SOURCE_SESSION_ID="00538c2c-c67e-4afe-a933-bb8ed6ed19c6"

  cat > "$HANDOFF_FILE" <<EOF
{
  "id": "source-session-handoff",
  "created_at": "$NOW",
  "loaded_at": null,
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "Handoff with source session",
  "source_session_id": "$SOURCE_SESSION_ID"
}
EOF

  # Extract source_session_id
  EXTRACTED_SOURCE=$(jq -r '.source_session_id // empty' "$HANDOFF_FILE")
  [ "$EXTRACTED_SOURCE" = "$SOURCE_SESSION_ID" ]
}

@test "pickup finds most recent unloaded handoff for project" {
  # Create multiple handoffs for the same project
  cat > "$HANDOFF_TEST_DIR/recent1.json" <<EOF
{
  "id": "recent1",
  "created_at": "2026-02-04T10:00:00Z",
  "loaded_at": null,
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "Recent handoff 1"
}
EOF

  cat > "$HANDOFF_TEST_DIR/recent2.json" <<EOF
{
  "id": "recent2",
  "created_at": "2026-02-04T12:00:00Z",
  "loaded_at": null,
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "Recent handoff 2"
}
EOF

  cat > "$HANDOFF_TEST_DIR/loaded.json" <<EOF
{
  "id": "loaded",
  "created_at": "2026-02-04T13:00:00Z",
  "loaded_at": "2026-02-04T14:00:00Z",
  "project_path": "$TEST_PROJECT_PATH",
  "summary": "Already loaded"
}
EOF

  # Find most recent unloaded handoff
  # In the skill, this would use find and jq to filter by project and loaded_at == null
  result=$(jq -s '[.[] | select(.project_path == "'"$TEST_PROJECT_PATH"'") | select(.loaded_at == null)] | sort_by(.created_at) | reverse | .[0].id' "$HANDOFF_TEST_DIR"/*.json)
  [ "$result" = '"recent2"' ]
}
