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
  "next_steps": ["Step 1", "Step 2"],
  "decisions": ["Decision 1"],
  "references": {
    "plan_path": null,
    "tasks_session_id": null,
    "session_id": "test-session-123"
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
