#!/usr/bin/env bash
# Git Guard Hook: Git Command Validator
# Prevents --no-verify usage in git commands
# Reads JSON input from stdin for PreToolUse hooks

set -euo pipefail

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly NC='\033[0m' # No Color

# Block a command with error message
block_command() {
    local error_msg="$1"
    local info_msg="${2:-}"

    echo -e "${RED}[ERROR]${NC} $error_msg" >&2
    if [ -n "$info_msg" ]; then
        echo -e "${GREEN}[INFO]${NC} $info_msg" >&2
    fi
    return 2
}

# Check if command matches a pattern
matches_pattern() {
    local command="$1"
    local pattern="$2"
    echo "$command" | grep -qE "$pattern"
}

validate_git_command() {
    local command="$1"

    # Check for --no-verify in git commit commands
    if matches_pattern "$command" "git\s+commit.*--no-verify"; then
        block_command "--no-verify is not allowed in this repository" \
            "Please use 'git commit' without --no-verify. All commits must pass quality checks."
        return $?
    fi

    # Check for other common bypass patterns
    if matches_pattern "$command" "git\s+.*skip.*hooks"; then
        block_command "Skipping hooks is not allowed"
        return $?
    fi

    if matches_pattern "$command" "git\s+.*--no-.*hook"; then
        block_command "Hook bypass is not allowed"
        return $?
    fi

    # Check for environment variable bypasses
    if matches_pattern "$command" "HUSKY=0.*git"; then
        block_command "HUSKY=0 bypass is not allowed"
        return $?
    fi

    if matches_pattern "$command" "SKIP_HOOKS=.*git"; then
        block_command "SKIP_HOOKS bypass is not allowed"
        return $?
    fi

    # Check for dangerous git commands that can bypass hooks
    if matches_pattern "$command" "git\s+update-ref"; then
        block_command "git update-ref is not allowed in this repository" \
            "This command can bypass commit hooks."
        return $?
    fi

    if matches_pattern "$command" "git\s+filter-branch"; then
        block_command "git filter-branch is not allowed in this repository" \
            "This command can rewrite history and bypass hooks."
        return $?
    fi

    # Check for hooksPath modification (security risk)
    if matches_pattern "$command" "git\s+config.*core\.hooksPath"; then
        block_command "Modifying core.hooksPath is not allowed in this repository" \
            "This can disable commit hooks."
        return $?
    fi

    return 0
}

# Extract git command from JSON input
extract_command_from_json() {
    local json_input="$1"

    # Use grep + sed to extract command field from JSON
    echo "$json_input" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"command"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/'
}

# Main execution
if [ $# -eq 0 ]; then
    # Read JSON from stdin (PreToolUse standard)
    json_input=$(cat)

    # Extract command from JSON
    command=$(extract_command_from_json "$json_input")

    # Validate the command if we got one
    if [ -n "$command" ]; then
        validate_git_command "$command"
        exit $?
    else
        # No command found, allow execution
        exit 0
    fi
else
    # Direct argument mode (fallback)
    command="$1"
    validate_git_command "$command"
    exit $?
fi
