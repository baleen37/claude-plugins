#!/usr/bin/env bash
# Git Guard Hook: Pre-commit Guard
# Runs pre-commit checks before allowing git operations
# This hook can be used with SessionStart or as a PreToolUse hook

set -euo pipefail

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Check if pre-commit is available
check_precommit_installed() {
    if ! command -v pre-commit &> /dev/null; then
        log_warn "pre-commit is not installed"
        log_info "Install it with: pip install pre-commit"
        return 1
    fi
    return 0
}

# Check if .pre-commit-config.yaml exists
check_precommit_config() {
    if [ ! -f ".pre-commit-config.yaml" ]; then
        log_warn "No .pre-commit-config.yaml found in current directory"
        return 1
    fi
    return 0
}

# Run pre-commit checks
run_precommit_checks() {
    local staged_only="${1:-false}"

    if ! check_precommit_installed; then
        return 0  # Don't block if pre-commit is not installed
    fi

    if ! check_precommit_config; then
        return 0  # Don't block if no config
    fi

    log_info "Running pre-commit checks..."

    if [ "$staged_only" = "true" ]; then
        pre-commit run --files "$(git diff --name-only --cached | tr '\n' ' ')"
    else
        pre-commit run --all-files
    fi

    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Pre-commit checks failed"
        log_info "Fix the issues and try again, or run: pre-commit run --all-files"
        return 2
    fi

    log_info "Pre-commit checks passed"
    return 0
}

# Extract git command from JSON input
extract_command_from_json() {
    local json_input="$1"
    echo "$json_input" | jq -r '.command // empty'
}

# Main execution
if [ $# -eq 0 ]; then
    # Read JSON from stdin (PreToolUse standard)
    json_input=$(cat)
    command=$(extract_command_from_json "$json_input")

    if [ -n "$command" ]; then
        # Trigger pre-commit checks before git commit
        if echo "$command" | grep -qE "git\s+commit"; then
            run_precommit_checks true
            exit $?
        fi

        # For git push, check all files
        if echo "$command" | grep -qE "git\s+push"; then
            run_precommit_checks false
            exit $?
        fi

        exit 0
    else
        # Direct execution (e.g., from SessionStart hook)
        run_precommit_checks false
        exit $?
    fi
else
    case "$1" in
        --check|-c)
            run_precommit_checks false
            exit $?
            ;;
        --staged|-s)
            run_precommit_checks true
            exit $?
            ;;
        *)
            echo "Usage: $0 [--check|--staged]" >&2
            exit 1
            ;;
    esac
fi
