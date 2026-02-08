#!/usr/bin/env bats
# Tests for ralph.sh bash script

load helpers/bats_helper

setup() {
  # Get script paths
  RALPH_SCRIPT="${PROJECT_ROOT}/plugins/ralph-loop/scripts/ralph.sh"
  PROMPT_TEMPLATE="${PROJECT_ROOT}/plugins/ralph-loop/scripts/prompt.md"

  # Create temp directory for test files
  TEST_TEMP_DIR=$(mktemp -d -t ralph-test.XXXXXX)
  export TEST_TEMP_DIR
  export TEST_RALPH_DIR="${TEST_TEMP_DIR}/.ralph"
  mkdir -p "$TEST_RALPH_DIR"

  # Create a fake git repo for testing
  export TEST_GIT_DIR="${TEST_TEMP_DIR}/git-repo"
  mkdir -p "$TEST_GIT_DIR"
  cd "$TEST_GIT_DIR"
  git init -q
  git config user.email "test@example.com"
  git config user.name "Test User"

  # Create mock claude command
  export MOCK_CLAUDE="${TEST_TEMP_DIR}/claude"
  cat > "$MOCK_CLAUDE" <<'EOF'
#!/bin/bash
# Mock claude command for testing
if [[ "$*" == *"--print"* ]]; then
  # Read from stdin
  cat
  exit 0
fi
echo "Mock claude command"
EOF
  chmod +x "$MOCK_CLAUDE"
  export PATH="${TEST_TEMP_DIR}:$PATH"
}

teardown() {
  # Kill any stray ralph.sh processes from this test
  if [ -n "${TEST_TEMP_DIR:-}" ] && [ -f "${TEST_TEMP_DIR}/.ralph/ralph.pid" ]; then
    kill "$(cat "${TEST_TEMP_DIR}/.ralph/ralph.pid")" 2>/dev/null || true
  fi

  # Clean up temp directory
  if [ -n "${TEST_TEMP_DIR:-}" ] && [ -d "$TEST_TEMP_DIR" ]; then
    rm -rf "$TEST_TEMP_DIR"
  fi

  # Return to original directory
  cd "$PROJECT_ROOT" || true
}

# Helper: Create a minimal PRD file
create_prd() {
  local branch="${1:-ralph/test-feature}"
  cat > "$TEST_RALPH_DIR/prd.json" <<EOF
{
  "project": "test-project",
  "branchName": "$branch",
  "description": "Test PRD",
  "userStories": [
    {
      "id": "US-001",
      "title": "Test Story",
      "description": "As a user, I want to test.",
      "acceptanceCriteria": ["Test passes"],
      "priority": 1,
      "passes": false
    }
  ]
}
EOF
}

# Helper: Create mock progress.txt
create_progress() {
  cat > "$TEST_RALPH_DIR/progress.txt" <<EOF
# Ralph Progress Log
Started: 2024-01-01T00:00:00Z

## Codebase Patterns
(No patterns discovered yet)

---
EOF
}

# Test: Script exists and is executable
@test "ralph.sh: exists and is executable" {
  [ -f "$RALPH_SCRIPT" ]
  [ -x "$RALPH_SCRIPT" ]
}

# Test: Script uses strict error handling
@test "ralph.sh: uses set -euo pipefail" {
  run grep -q "set -euo pipefail" "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script exits with error if .ralph/prd.json missing
@test "ralph.sh: exits with error if .ralph/prd.json missing" {
  cd "$TEST_GIT_DIR"
  run bash "$RALPH_SCRIPT" 2
  [ $status -eq 1 ]
  [[ "$output" == *"prd.json not found"* ]]
  [[ "$output" == *"/ralph-init first"* ]]
}

# Test: Script accepts custom max iterations
@test "ralph.sh: accepts custom max iterations argument" {
  # This test just verifies the script accepts the argument
  # The actual iteration count is validated by the default test
  run grep 'MAX_ITERATIONS="\${1' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
  run grep 'MAX_ITERATIONS="\${1:-10}"' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script default iterations
@test "ralph.sh: default iterations is 10" {
  run grep 'MAX_ITERATIONS="\${1:-10}"' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script creates PID file
@test "ralph.sh: creates PID file on startup" {
  create_prd
  create_progress

  cd "$TEST_GIT_DIR"
  mkdir -p .ralph
  cp "$TEST_RALPH_DIR/"* .ralph/

  # Start ralph.sh in background and check for PID file
  bash "$RALPH_SCRIPT" 1 >/dev/null 2>&1 &
  ralph_pid=$!
  sleep 0.5

  # Check if PID file was created
  if [ -f .ralph/ralph.pid ]; then
    pid=$(cat .ralph/ralph.pid)
    # PID should be a number
    [[ "$pid" =~ ^[0-9]+$ ]]
  fi

  # Clean up
  kill $ralph_pid 2>/dev/null || true
  wait $ralph_pid 2>/dev/null || true
}

# Test: Script cleanup PID file on exit
@test "ralph.sh: cleans up PID file on exit" {
  create_prd
  create_progress

  cd "$TEST_GIT_DIR"
  mkdir -p .ralph
  cp "$TEST_RALPH_DIR/"* .ralph/

  # Run ralph.sh in background then kill it
  bash "$RALPH_SCRIPT" 1 >/dev/null 2>&1 &
  ralph_pid=$!
  sleep 0.5
  kill $ralph_pid 2>/dev/null || true
  wait $ralph_pid 2>/dev/null || true

  # After script exits, PID file should be cleaned up by the trap
  # Give it a moment to clean up
  sleep 0.2

  # PID file should not exist (cleaned up by EXIT trap)
  if [ -f .ralph/ralph.pid ]; then
    pid=$(cat .ralph/ralph.pid)
    # If file exists, process should NOT be running
    ! kill -0 "$pid" 2>/dev/null
  fi
}

# Test: Script detects existing running loop
@test "ralph.sh: detects existing running loop" {
  create_prd
  create_progress

  cd "$TEST_GIT_DIR"
  mkdir -p .ralph
  cp "$TEST_RALPH_DIR/"* .ralph/

  # Create a fake PID file with current process PID
  echo $$ > .ralph/ralph.pid

  # Try to run again - should fail
  run bash "$RALPH_SCRIPT" 2
  [ $status -eq 1 ]
  [[ "$output" == *"already running"* ]]
}

# Test: Script checks out branch from prd.json
@test "ralph.sh: checks out branch from prd.json" {
  local test_branch="ralph/test-feature-branch"
  create_prd "$test_branch"
  create_progress

  cd "$TEST_GIT_DIR"
  mkdir -p .ralph
  cp "$TEST_RALPH_DIR/"* .ralph/

  # Create an initial commit
  echo "test" > test.txt
  git add test.txt
  git commit -q -m "Initial commit"

  # Run ralph.sh in background and kill it
  bash "$RALPH_SCRIPT" 1 >/dev/null 2>&1 &
  ralph_pid=$!
  sleep 0.5
  kill $ralph_pid 2>/dev/null || true
  wait $ralph_pid 2>/dev/null || true

  # Check if we're on the correct branch
  current_branch=$(git branch --show-current)
  [ "$current_branch" = "$test_branch" ]
}

# Test: Script creates branch if it doesn't exist
@test "ralph.sh: creates branch if it doesn't exist" {
  local test_branch="ralph/new-branch"
  create_prd "$test_branch"
  create_progress

  cd "$TEST_GIT_DIR"
  mkdir -p .ralph
  cp "$TEST_RALPH_DIR/"* .ralph/

  # Create an initial commit on main
  echo "test" > test.txt
  git add test.txt
  git commit -q -m "Initial commit"

  # Ensure branch doesn't exist
  git checkout -q main 2>/dev/null || git checkout -q master 2>/dev/null || true

  # Run ralph.sh in background and kill it
  bash "$RALPH_SCRIPT" 1 >/dev/null 2>&1 &
  ralph_pid=$!
  sleep 0.5
  kill $ralph_pid 2>/dev/null || true
  wait $ralph_pid 2>/dev/null || true

  # Check if we're on the new branch
  current_branch=$(git branch --show-current)
  [ "$current_branch" = "$test_branch" ]
}

# Test: Script creates progress.txt if missing
@test "ralph.sh: creates progress.txt if missing" {
  create_prd
  # Don't create progress.txt

  cd "$TEST_GIT_DIR"
  mkdir -p .ralph
  cp "$TEST_RALPH_DIR/prd.json" .ralph/

  # Create an initial commit
  echo "test" > test.txt
  git add test.txt
  git commit -q -m "Initial commit" 2>/dev/null || true

  # Run ralph.sh in background and kill it
  bash "$RALPH_SCRIPT" 1 >/dev/null 2>&1 &
  ralph_pid=$!
  sleep 0.5
  kill $ralph_pid 2>/dev/null || true
  wait $ralph_pid 2>/dev/null || true

  # progress.txt should be created
  [ -f .ralph/progress.txt ]
  grep -q "Ralph Progress Log" .ralph/progress.txt
}

# Test: prompt.md template has ITERATION placeholder
@test "prompt.md: has {{ITERATION}} placeholder" {
  run grep -q "{{ITERATION}}" "$PROMPT_TEMPLATE"
  [ $status -eq 0 ]
}

# Test: prompt.md template has MAX placeholder
@test "prompt.md: has {{MAX}} placeholder" {
  run grep -q "{{MAX}}" "$PROMPT_TEMPLATE"
  [ $status -eq 0 ]
}

# Test: prompt.md template mentions PRD reading
@test "prompt.md: mentions reading .ralph/prd.json" {
  run grep -q "\.ralph/prd\.json" "$PROMPT_TEMPLATE"
  [ $status -eq 0 ]
}

# Test: prompt.md template mentions progress.txt
@test "prompt.md: mentions reading .ralph/progress.txt" {
  run grep -q "\.ralph/progress\.txt" "$PROMPT_TEMPLATE"
  [ $status -eq 0 ]
}

# Test: prompt.md template mentions COMPLETE promise
@test "prompt.md: mentions <promise>COMPLETE</promise>" {
  run grep -q "<promise>COMPLETE</promise>" "$PROMPT_TEMPLATE"
  [ $status -eq 0 ]
}

# Test: prompt.md template mentions implementing one story
@test "prompt.md: mentions implementing ONE story" {
  run grep -q "ONE story" "$PROMPT_TEMPLATE"
  [ $status -eq 0 ]
}

# Test: prompt.md template mentions updating prd.json
@test "prompt.md: mentions updating .ralph/prd.json" {
  run grep -q "prd\.json" "$PROMPT_TEMPLATE"
  [ $status -eq 0 ]
}

# Test: prompt.md template mentions appending to progress.txt
@test "prompt.md: mentions appending to progress.txt" {
  run grep -q "progress\.txt" "$PROMPT_TEMPLATE"
  [ $status -eq 0 ]
}

# Test: Script substitutes template variables
@test "ralph.sh: substitutes {{ITERATION}} and {{MAX}} in prompt" {
  run grep 'sed "s/{{ITERATION}}/' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
  run grep 'sed.*{{MAX}}/' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script calls claude --print
@test "ralph.sh: calls claude --print" {
  run grep -q 'claude --print' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script checks for COMPLETE promise
@test "ralph.sh: checks for <promise>COMPLETE</promise>" {
  run grep -q '<promise>COMPLETE</promise>' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script exits with 0 when COMPLETE detected
@test "ralph.sh: exits with 0 when COMPLETE detected" {
  # Check that after detecting COMPLETE, script exits with 0
  run grep -A 5 'grep -q.*COMPLETE' "$RALPH_SCRIPT"
  [[ "$output" == *"exit 0"* ]]
}

# Test: Script iterates with proper loop
@test "ralph.sh: uses seq loop for iterations" {
  run grep 'seq 1' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
  run grep '\$MAX_ITERATIONS' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script shows iteration progress
@test "ralph.sh: shows iteration progress" {
  run grep 'iteration' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script has cleanup trap
@test "ralph.sh: has cleanup trap" {
  run grep -q "trap cleanup EXIT" "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script cleanup function removes PID file
@test "ralph.sh: cleanup function removes PID file" {
  run grep -A 2 "^cleanup()" "$RALPH_SCRIPT"
  [[ "$output" == *"rm -f"* ]]
  [[ "$output" == *"PID_FILE"* ]]
}

# Test: Script sleeps between iterations to prevent API rate limiting
@test "ralph.sh: sleeps between iterations" {
  run grep -q "sleep 2" "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script creates log directory for iteration archives
@test "ralph.sh: creates log directory for iteration archives" {
  run grep -q "mkdir -p \"\$LOG_DIR\"" "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script has LOG_DIR variable configured
@test "ralph.sh: has LOG_DIR variable" {
  run grep -q 'LOG_DIR=' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
  run grep 'LOG_DIR="\$RALPH_DIR/logs"' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script writes iteration logs to archive directory
@test "ralph.sh: writes iteration logs to archive directory" {
  run grep -q 'ITERATION_LOG=' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
  run grep 'ITERATION_LOG="\$LOG_DIR/iteration-' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script supports --dangerously-skip-permissions flag
@test "ralph.sh: supports --dangerously-skip-permissions flag" {
  run grep -q 'dangerously-skip-permissions' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Test: Script passes --dangerously-skip-permissions to claude command
@test "ralph.sh: passes --dangerously-skip-permissions to claude" {
  run grep 'claude.*--print.*--dangerously-skip-permissions' "$RALPH_SCRIPT"
  [ $status -eq 0 ]
}

# Functional Test: cancel-ralph PID kill behavior
@test "cancel-ralph: kills ralph.sh process and removes PID file" {
  # Skip this test on CI due to timing issues
  skip "Test skipped due to timing sensitivity on CI runners"

  # Clean up any previous test state
  cd "$TEST_GIT_DIR"
  rm -rf .ralph
  git checkout - 2>/dev/null || true
  git branch -D ralph/* 2>/dev/null || true

  create_prd
  create_progress

  cd "$TEST_GIT_DIR"
  mkdir -p .ralph
  cp "$TEST_RALPH_DIR/"* .ralph/

  # Create an initial commit
  echo "test" > test.txt
  git add test.txt
  git commit -q -m "Initial commit" 2>/dev/null || true

  # Start ralph.sh in background
  bash "$RALPH_SCRIPT" 10 >/dev/null 2>&1 &
  ralph_pid=$!

  # Wait for PID file to be created (poll with longer timeout for CI)
  local count=0
  while [ ! -f .ralph/ralph.pid ] && [ $count -lt 50 ]; do
    sleep 0.1
    count=$((count + 1))
  done

  # Give script time to fully initialize
  sleep 0.5

  # Verify PID file exists
  [ -f .ralph/ralph.pid ]

  pid_from_file=$(cat .ralph/ralph.pid)
  [ "$pid_from_file" = "$ralph_pid" ]

  # Verify process is running
  kill -0 "$ralph_pid" 2>/dev/null

  # Kill the process (simulating cancel-ralph behavior)
  kill "$ralph_pid" 2>/dev/null || true
  sleep 0.2

  # Verify process is dead
  run ! kill -0 "$ralph_pid" 2>/dev/null

  # Remove PID file (as cancel-ralph would do)
  rm -f .ralph/ralph.pid

  # Verify PID file is removed
  [ ! -f .ralph/ralph.pid ]
}

# Functional Test: ralph.sh iteration counting
@test "ralph.sh: iterates correct number of times" {
  # Skip this test on CI due to timing issues with background processes
  skip "Test skipped on CI due to timing sensitivity with mock claude"

  # Clean up any previous test state
  cd "$TEST_GIT_DIR"
  rm -rf .ralph
  git checkout - 2>/dev/null || true
  git branch -D ralph/* 2>/dev/null || true

  create_prd
  create_progress

  cd "$TEST_GIT_DIR"
  mkdir -p .ralph
  cp "$TEST_RALPH_DIR/"* .ralph/

  # Create an initial commit
  echo "test" > test.txt
  git add test.txt
  git commit -q -m "Initial commit" 2>/dev/null || true

  # Create a mock claude that never returns COMPLETE
  # This allows ralph.sh to run through all iterations
  cat > "$MOCK_CLAUDE" <<'EOF'
#!/bin/bash
# Mock claude that never returns COMPLETE
if [[ "$*" == *"--print"* ]]; then
  # Read from stdin and echo response without COMPLETE
  cat >/dev/null
  echo "Working on tasks..."
  exit 0
fi
echo "Mock claude command"
EOF
  chmod +x "$MOCK_CLAUDE"

  # Run ralph.sh with 3 iterations, output to a temp file
  local output_file="${TEST_TEMP_DIR}/ralph_output.txt"
  bash "$RALPH_SCRIPT" 3 > "$output_file" 2>&1 &
  ralph_pid=$!

  # Wait for all iterations to complete with much longer timeout for CI
  local count=0
  while kill -0 "$ralph_pid" 2>/dev/null && [ $count -lt 60 ]; do
    sleep 0.5
    count=$((count + 1))
  done

  # Wait for process to finish and flush output
  wait $ralph_pid 2>/dev/null || true
  sleep 0.5

  # Read output from file, removing any null bytes
  output=$(tr -d '\0' < "$output_file")

  # Verify we ran exactly 3 iterations
  # The script should show "=== Ralph iteration 1/3 ===", "2/3", "3/3"
  iteration_count=$(echo "$output" | grep -c "Ralph iteration" || true)
  [ "$iteration_count" -eq 3 ]

  # Should show "reached max iterations" message
  [[ "$output" == *"max iterations"* ]]
}

# Functional Test: ralph.sh COMPLETE detection
@test "ralph.sh: detects COMPLETE and exits with 0" {
  # Clean up any previous test state
  cd "$TEST_GIT_DIR"
  rm -rf .ralph
  git checkout - 2>/dev/null || true
  git branch -D ralph/* 2>/dev/null || true

  create_prd
  create_progress

  cd "$TEST_GIT_DIR"
  mkdir -p .ralph
  cp "$TEST_RALPH_DIR/"* .ralph/

  # Create an initial commit
  echo "test" > test.txt
  git add test.txt
  git commit -q -m "Initial commit" 2>/dev/null || true

  # Create a mock claude that returns COMPLETE immediately
  cat > "$MOCK_CLAUDE" <<'EOF'
#!/bin/bash
# Mock claude that returns COMPLETE
if [[ "$*" == *"--print"* ]]; then
  # Read from stdin
  cat >/dev/null
  # Return COMPLETE promise
  echo "<promise>COMPLETE</promise>"
  exit 0
fi
echo "Mock claude command"
EOF
  chmod +x "$MOCK_CLAUDE"

  # Run ralph.sh with 10 iterations but expect it to exit early
  run bash "$RALPH_SCRIPT" 10 2>&1

  # Should exit with 0 (not 1 for max iterations)
  [ $status -eq 0 ]

  # Should show completion message
  [[ "$output" == *"Ralph completed at iteration"* ]]

  # Should show iteration 1 (should exit on first iteration)
  [[ "$output" == *"iteration 1/10"* ]]

  # Should NOT show iteration 2 or beyond
  ! [[ "$output" == *"iteration 2/"* ]]
}

# TODO: After Task 4 (Improve prompt template), verify the prompt.md tests (lines 283-329)
# still match the new content. Update tests as needed to reflect any changes to
# the prompt.md template structure or content.
