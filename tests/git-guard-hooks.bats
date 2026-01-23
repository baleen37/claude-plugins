#!/usr/bin/env bats
# Tests for Git Guard hooks - JSON parsing and validation

load helpers/bats_helper

setup() {
    COMMIT_GUARD="$PROJECT_ROOT/plugins/git-guard/hooks/commit-guard.sh"
}

@test "commit-guard.sh exists and is executable" {
    [ -f "$COMMIT_GUARD" ]
    [ -x "$COMMIT_GUARD" ]
}

@test "commit-guard.sh parses JSON with escaped quotes correctly" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"git commit -m \"test message\" --no-verify"}
EOF
    [ "$status" -eq 2 ]
    [[ "$output" =~ "--no-verify is not allowed" ]]
}

@test "commit-guard.sh blocks --no-verify" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"git commit --no-verify"}
EOF
    [ "$status" -eq 2 ]
    [[ "$output" =~ "--no-verify is not allowed" ]]
}

@test "commit-guard.sh allows normal git commit" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"git commit -m \"normal commit\""}
EOF
    [ "$status" -eq 0 ]
}

@test "commit-guard.sh allows git status" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"git status"}
EOF
    [ "$status" -eq 0 ]
}

@test "commit-guard.sh blocks HUSKY=0 bypass" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"HUSKY=0 git commit"}
EOF
    [ "$status" -eq 2 ]
    [[ "$output" =~ "HUSKY=0 bypass is not allowed" ]]
}

@test "commit-guard.sh blocks git update-ref" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"git update-ref"}
EOF
    [ "$status" -eq 2 ]
    [[ "$output" =~ "git update-ref is not allowed" ]]
}

@test "commit-guard.sh blocks core.hooksPath modification" {
    run bash "$COMMIT_GUARD" <<'EOF'
{"tool":"Bash","command":"git config core.hooksPath /dev/null"}
EOF
    [ "$status" -eq 2 ]
    [[ "$output" =~ "core.hooksPath is not allowed" ]]
}
