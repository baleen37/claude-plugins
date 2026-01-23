#!/usr/bin/env bats
# Tests for conflict-check.sh - false positive detection

load helpers/bats_helper

setup() {
    # Create a temp git repo for testing
    TEST_REPO_DIR=$(mktemp -d -t conflict-test.XXXXXX)
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

    CONFLICT_CHECK="$PROJECT_ROOT/plugins/me/skills/create-pr/scripts/conflict-check.sh"
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

@test "conflict-check.sh exists and is executable" {
    [ -f "$CONFLICT_CHECK" ]
    [ -x "$CONFLICT_CHECK" ]
}

# RED TEST: This should fail with current implementation
@test "conflict-check.sh does NOT report false positive when code contains 'CONFLICT' string" {
    cd "$TEST_REPO_DIR"

    # Create feature branch with code containing "CONFLICT" string
    git checkout -q -b feature/test
    cat > code.js <<'EOF'
// This file contains the word CONFLICT in comments
const ERROR_MESSAGES = {
    CONFLICT: "Resource conflict detected",
    NOT_FOUND: "Resource not found"
};

function handleConflict() {
    console.log("CONFLICT detected");
}
EOF
    git add code.js
    git commit -q -m "feat: add conflict handling code"
    git push -q -u origin feature/test

    # Main branch has different file (to create divergence without conflict)
    git checkout -q main
    cat > other.js <<'EOF'
const OTHER = "other";
EOF
    git add other.js
    git commit -q -m "feat: add other file"
    git push -q origin main

    git checkout -q feature/test

    # Run conflict check - should pass (no real conflicts)
    run bash "$CONFLICT_CHECK" main
    echo "Status: $status"
    echo "Output: $output"

    [ "$status" -eq 0 ]
    [[ "$output" =~ "No merge conflicts detected" ]]
    [[ ! "$output" =~ "code.js" ]]
}

# RED TEST: This should fail with current implementation
@test "conflict-check.sh DOES report true positive when actual merge conflict exists" {
    cd "$TEST_REPO_DIR"

    # Create conflicting changes
    git checkout -q -b feature/conflict
    echo "feature version" > file.txt
    git add file.txt
    git commit -q -m "feat: update file"
    git push -q -u origin feature/conflict

    # Update main with different content
    git checkout -q main
    echo "main version" > file.txt
    git add file.txt
    git commit -q -m "fix: update file differently"
    git push -q origin main

    # Back to feature branch
    git checkout -q feature/conflict

    # Run conflict check - should fail (real conflicts exist)
    run bash "$CONFLICT_CHECK" main
    echo "Status: $status"
    echo "Output: $output"

    [ "$status" -eq 1 ]
    [[ "$output" =~ "Merge conflicts detected" ]]
    [[ "$output" =~ "file.txt" ]]
}

@test "conflict-check.sh handles code with multiple 'CONFLICT' occurrences without false positive" {
    cd "$TEST_REPO_DIR"

    git checkout -q -b feature/multi-conflict
    cat > handler.py <<'EOF'
# Error handling module
CONFLICT_ERROR = "CONFLICT"
NO_CONFLICT = "NO_CONFLICT"

def check_conflict():
    """Check for CONFLICT status"""
    if status == CONFLICT_ERROR:
        print("CONFLICT found")
    return CONFLICT_ERROR

# This comment also mentions CONFLICT
EOF
    git add handler.py
    git commit -q -m "feat: add conflict error handler"
    git push -q -u origin feature/multi-conflict

    # No changes on main

    # Should pass - these are just strings in code
    run bash "$CONFLICT_CHECK" main
    echo "Status: $status"
    echo "Output: $output"

    [ "$status" -eq 0 ]
    [[ "$output" =~ "No merge conflicts detected" ]]
}

@test "conflict-check.sh detects real conflict markers in file content" {
    cd "$TEST_REPO_DIR"

    # Simulate two branches modifying the same line
    git checkout -q -b feature/real-conflict
    cat > shared.txt <<'EOF'
Line 1
Feature change here
Line 3
EOF
    git add shared.txt
    git commit -q -m "feat: feature change"
    git push -q -u origin feature/real-conflict

    # Main makes different change
    git checkout -q main
    cat > shared.txt <<'EOF'
Line 1
Main change here
Line 3
EOF
    git add shared.txt
    git commit -q -m "fix: main change"
    git push -q origin main

    git checkout -q feature/real-conflict

    # Should detect conflict
    run bash "$CONFLICT_CHECK" main
    echo "Status: $status"
    echo "Output: $output"

    [ "$status" -eq 1 ]
    [[ "$output" =~ "Merge conflicts detected" ]]
    [[ "$output" =~ "shared.txt" ]]
}

@test "conflict-check.sh ignores commented-out conflict markers" {
    cd "$TEST_REPO_DIR"

    git checkout -q -b feature/commented-markers
    cat > example.md <<'EOF'
# Git Conflict Resolution Guide

When you see conflict markers like this:

```
<<<<<<< HEAD
Your changes
=======
Their changes
>>>>>>> branch
```

You need to resolve them manually.
EOF
    git add example.md
    git commit -q -m "docs: add conflict resolution guide"
    git push -q -u origin feature/commented-markers

    # Main diverges without conflict
    git checkout -q main
    echo "other doc" > README.md
    git add README.md
    git commit -q -m "docs: add readme"
    git push -q origin main

    git checkout -q feature/commented-markers

    # Should pass - these are documentation, not real conflicts
    run bash "$CONFLICT_CHECK" main
    echo "Status: $status"
    echo "Output: $output"

    [ "$status" -eq 0 ]
    [[ "$output" =~ "No merge conflicts detected" ]]
}

# CRITICAL RED TEST: grep "CONFLICT" will match this but shouldn't
@test "conflict-check.sh ignores git merge-tree showing word CONFLICT in added content" {
    cd "$TEST_REPO_DIR"

    git checkout -q -b feature/conflict-in-content
    # Add file with "CONFLICT" in the content (no merge conflict, just new code)
    cat > status_codes.py <<'EOF'
# Status codes
CONFLICT = 409
SUCCESS = 200

def handle_conflict():
    """Handle CONFLICT status"""
    return CONFLICT
EOF
    git add status_codes.py
    git commit -q -m "feat: add status codes with CONFLICT constant"
    git push -q -u origin feature/conflict-in-content

    # Main adds different file (divergent but not conflicting)
    git checkout -q main
    echo "unrelated change" > unrelated.txt
    git add unrelated.txt
    git commit -q -m "chore: add unrelated file"
    git push -q origin main

    git checkout -q feature/conflict-in-content

    # Should pass - "CONFLICT" appears in diff output but it's just added content
    run bash "$CONFLICT_CHECK" main
    echo "Status: $status"
    echo "Output: $output"
    echo "=== Debugging: actual merge-tree output ==="
    MERGE_BASE=$(git merge-base HEAD origin/main)
    git merge-tree "$MERGE_BASE" HEAD origin/main 2>&1 || true

    [ "$status" -eq 0 ]
    [[ "$output" =~ "No merge conflicts detected" ]]
}
