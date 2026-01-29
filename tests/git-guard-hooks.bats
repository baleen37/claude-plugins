#!/usr/bin/env bats
# Tests for Git Guard hooks - JSON parsing and validation

load helpers/bats_helper

setup() {
    COMMIT_GUARD="$PROJECT_ROOT/plugins/git-guard/hooks/commit-guard.sh"
}

@test "commit-guard.sh exists and is executable" {
    assert_file_exists "$COMMIT_GUARD" "commit-guard.sh should exist"
    [ -x "$COMMIT_GUARD" ]
}

@test "commit-guard.sh parses JSON with escaped quotes correctly" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"git commit -m \"test message\" --no-verify"}
EOF
    [ "$status" -eq 2 ]
    assert_matches "$output" "--no-verify is not allowed" "should block --no-verify in escaped quotes"
}

@test "commit-guard.sh blocks --no-verify" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"git commit --no-verify"}
EOF
    [ "$status" -eq 2 ]
    assert_matches "$output" "--no-verify is not allowed" "should block --no-verify flag"
}

@test "commit-guard.sh allows normal git commit" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"git commit -m \"normal commit\""}
EOF
    assert_eq "$status" "0" "should allow normal git commit"
}

@test "commit-guard.sh allows git status" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"git status"}
EOF
    assert_eq "$status" "0" "should allow git status command"
}

@test "commit-guard.sh blocks HUSKY=0 bypass" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"HUSKY=0 git commit"}
EOF
    [ "$status" -eq 2 ]
    assert_matches "$output" "HUSKY=0 bypass is not allowed" "should block HUSKY=0 bypass attempt"
}

@test "commit-guard.sh blocks git update-ref" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"git update-ref"}
EOF
    [ "$status" -eq 2 ]
    assert_matches "$output" "git update-ref is not allowed" "should block git update-ref command"
}

@test "commit-guard.sh blocks core.hooksPath modification" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"git config core.hooksPath /dev/null"}
EOF
    [ "$status" -eq 2 ]
    assert_matches "$output" "core.hooksPath is not allowed" "should block core.hooksPath modification"
}
