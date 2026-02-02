#!/usr/bin/env bash
# run-typescript-tests.sh: Run Jest tests for TypeScript plugins
#
# This script runs Jest tests for TypeScript-based plugins:
# - auto-updater
# - git-guard
# - memory-persistence
# - ralph-loop
#
# Exit code: 0 if all tests pass, 1 if any test fails

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Track failures
FAILED_TESTS=()

# TypeScript plugins
TS_PLUGINS=("auto-updater" "git-guard" "memory-persistence" "ralph-loop")

# Function to run tests for a TypeScript plugin
run_ts_plugin_tests() {
    local plugin_name="$1"
    local plugin_dir="${PROJECT_ROOT}/plugins/${plugin_name}"

    echo "========================================"
    echo "Running tests: ${plugin_name}"
    echo "========================================"

    # Check if plugin has package.json
    if [ ! -f "${plugin_dir}/package.json" ]; then
        echo -e "${YELLOW}⊘ ${plugin_name} skipped (no package.json)${NC}"
        return 0
    fi

    # Check if node_modules exists
    if [ ! -d "${plugin_dir}/node_modules" ]; then
        echo -e "${YELLOW}⊘ ${plugin_name} skipped (dependencies not installed)${NC}"
        echo "  Run: cd plugins/${plugin_name} && npm install"
        return 0
    fi

    # Change to plugin directory
    cd "${plugin_dir}" || return 1

    # Run tests
    if npm test --silent 2>&1; then
        echo -e "${GREEN}✓ ${plugin_name} tests passed${NC}"
        cd "${PROJECT_ROOT}"
        return 0
    else
        echo -e "${RED}✗ ${plugin_name} tests failed${NC}"
        FAILED_TESTS+=("${plugin_name}")
        cd "${PROJECT_ROOT}"
        return 1
    fi
}

# Main execution
main() {
    echo -e "${YELLOW}Running TypeScript plugin tests...${NC}"
    echo ""

    # Run tests for each TypeScript plugin
    for plugin in "${TS_PLUGINS[@]}"; do
        run_ts_plugin_tests "${plugin}"
        echo ""
    done

    # Report results
    echo "========================================"
    echo "Test Results Summary"
    echo "========================================"

    if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
        echo -e "${GREEN}All TypeScript tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed:${NC}"
        for failed_test in "${FAILED_TESTS[@]}"; do
            echo "  - ${failed_test}"
        done
        exit 1
    fi
}

# Run main function
main "$@"
