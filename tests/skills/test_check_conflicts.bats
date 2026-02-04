#!/usr/bin/env bats

# Tests for check-conflicts.sh script

setup() {
  # Get script path
  SCRIPT="${BATS_TEST_DIRNAME}/../../plugins/me/skills/create-pr/scripts/check-conflicts.sh"

  # Verify script exists
  if [[ ! -f "$SCRIPT" ]]; then
    skip "check-conflicts.sh not found"
  fi
}

@test "check-conflicts.sh: fails without arguments" {
  run "$SCRIPT"
  [ "$status" -eq 2 ]
  [[ "$output" =~ "ERROR: Missing base branch argument" ]]
}

@test "check-conflicts.sh: shows usage on error" {
  run "$SCRIPT"
  [ "$status" -eq 2 ]
  [[ "$output" =~ "Usage:" ]]
}

@test "check-conflicts.sh: is executable" {
  [ -x "$SCRIPT" ]
}

@test "check-conflicts.sh: has proper shebang" {
  head -n 1 "$SCRIPT" | grep -q "^#!/usr/bin/env bash"
}

@test "check-conflicts.sh: uses set -euo pipefail" {
  grep -q "set -euo pipefail" "$SCRIPT"
}

@test "check-conflicts.sh: documents exit codes" {
  grep -q "Exit codes:" "$SCRIPT"
  grep -q "0 - No conflicts" "$SCRIPT"
  grep -q "1 - Conflicts detected" "$SCRIPT"
  grep -q "2 - Error" "$SCRIPT"
}

@test "check-conflicts.sh: checks for git repository" {
  # Create temp directory (not a git repo)
  TEMP_DIR=$(mktemp -d)

  cd "$TEMP_DIR"
  run "$SCRIPT" main

  [ "$status" -eq 2 ]
  [[ "$output" =~ "Not in a git repository" ]]

  # Cleanup
  rm -rf "$TEMP_DIR"
}

# Note: Full integration tests require actual git repository
# with branches and conflicts. These would be better suited
# for manual testing or CI environment with test fixtures.
#
# Mock-based tests could be added here using bats-mock
# if more comprehensive testing is needed.
