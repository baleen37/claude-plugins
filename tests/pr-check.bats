#!/usr/bin/env bats
# Tests for pr-check.sh - false positive detection in conflict warnings

load helpers/bats_helper

setup() {
    # Create a temp git repo for testing
    TEST_REPO_DIR=$(mktemp -d -t pr-check-test.XXXXXX)
    cd "$TEST_REPO_DIR"

    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    # Create initial commit on main
    echo "initial content" > file.txt
    git add file.txt
    git commit -q -m "Initial commit"

    # Create a remote simulation
    REMOTE_DIR=$(mktemp -d -t remote.XXXXXX)
    cd "$REMOTE_DIR"
    git init -q --bare
    cd "$TEST_REPO_DIR"
    git remote add origin "$REMOTE_DIR"
    git push -q origin main

    PR_CHECK="$PROJECT_ROOT/plugins/me/skills/create-pr/scripts/pr-check.sh"
}

teardown() {
    # Clean up temp directories
    if [ -n "${TEST_REPO_DIR:-}" ] && [ -d "$TEST_REPO_DIR" ]; then
        rm -rf "$TEST_REPO_DIR"
    fi
    if [ -n "${REMOTE_DIR:-}" ] && [ -d "$REMOTE_DIR" ]; then
        rm -rf "$REMOTE_DIR"
    fi
}

@test "pr-check.sh exists and is executable" {
    [ -f "$PR_CHECK" ]
    [ -x "$PR_CHECK" ]
}

# RED TEST: This should fail with current implementation
@test "pr-check.sh does NOT warn about conflicts when code contains 'CONFLICT' string" {
    cd "$TEST_REPO_DIR"

    git checkout -q -b feature/no-real-conflict
    cat > error_codes.js <<'EOF'
const ErrorCodes = {
    CONFLICT: 409,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500
};

// Handle CONFLICT errors
function isConflict(code) {
    return code === ErrorCodes.CONFLICT;
}
EOF
    git add error_codes.js
    git commit -q -m "feat: add error codes including CONFLICT"
    git push -q -u origin feature/no-real-conflict

    # Run pr-check - should NOT show conflict warning
    run bash "$PR_CHECK"
    echo "Status: $status"
    echo "Output: $output"

    [ "$status" -eq 0 ]
    [[ "$output" =~ "# Conflict Check" ]]
    [[ "$output" =~ "✓ No conflicts" ]]
    [[ ! "$output" =~ "⚠️  Merge conflicts detected" ]]
}

# RED TEST: Current implementation should correctly detect this
@test "pr-check.sh DOES warn about conflicts when actual merge conflict exists" {
    cd "$TEST_REPO_DIR"

    # Create conflicting changes
    git checkout -q -b feature/real-conflict
    echo "feature version" > shared.txt
    git add shared.txt
    git commit -q -m "feat: feature change"
    git push -q -u origin feature/real-conflict

    # Update main
    git checkout -q main
    echo "main version" > shared.txt
    git add shared.txt
    git commit -q -m "fix: main change"
    git push -q origin main

    git checkout -q feature/real-conflict

    # Run pr-check - should show conflict warning
    run bash "$PR_CHECK"
    echo "Status: $status"
    echo "Output: $output"

    [ "$status" -eq 0 ]
    [[ "$output" =~ "# Conflict Check" ]]
    [[ "$output" =~ "⚠️  Merge conflicts detected" ]]
}

@test "pr-check.sh handles documentation about conflict markers without false positive" {
    cd "$TEST_REPO_DIR"

    git checkout -q -b feature/docs
    cat > CONTRIBUTING.md <<'EOF'
# Contributing Guide

## Resolving Merge Conflicts

If you see CONFLICT markers, follow these steps:

1. Look for conflict indicators
2. The word CONFLICT will appear in git output
3. Use `git status` to find CONFLICT files

Example conflict markers:
- <<<<<<< HEAD
- =======
- >>>>>>> branch
EOF
    git add CONTRIBUTING.md
    git commit -q -m "docs: add conflict resolution guide"
    git push -q -u origin feature/docs

    # Should NOT show conflict warning
    run bash "$PR_CHECK"
    echo "Status: $status"
    echo "Output: $output"

    [ "$status" -eq 0 ]
    [[ "$output" =~ "✓ No conflicts" ]]
    [[ ! "$output" =~ "⚠️  Merge conflicts detected" ]]
}
