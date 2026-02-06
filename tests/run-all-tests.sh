#!/usr/bin/env bash
# run-all-tests.sh: Run all tests (root + plugins) and collect failures
#
# This script runs all tests in the project:
# 1. Root tests in tests/
# 2. Plugin tests in plugins/*/tests/
#
# Exit code: 0 if all tests pass, 1 if any test fails

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Source runtime test helpers
source "${SCRIPT_DIR}/helpers/runtime-tester.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Track failures
FAILED_TESTS=()
FAILED_PLUGINS=()

# Function to run bats tests and track failures
run_tests() {
    local test_dir="$1"
    local label="$2"

    echo "========================================"
    echo "Running ${label}..."
    echo "========================================"

    if bats "${test_dir}"; then
        echo -e "${GREEN}✓ ${label} passed${NC}"
        return 0
    else
        echo -e "${RED}✗ ${label} failed${NC}"
        FAILED_TESTS+=("${label}")
        return 1
    fi
}

# Function to get plugin runtime from plugin.json
get_plugin_runtime() {
    local plugin_dir="$1"
    local plugin_json="${plugin_dir}.claude-plugin/plugin.json"

    if [ -f "${plugin_json}" ]; then
        jq -r '.runtime // "bash"' "${plugin_json}"
    else
        echo "bash"
    fi
}

# Function to discover and run plugin tests
run_plugin_tests() {
    local plugin_dir="$1"
    local plugin_name
    plugin_name=$(basename "${plugin_dir}")

    local runtime
    runtime=$(get_plugin_runtime "${plugin_dir}")

    case "${runtime}" in
        bun)
            if [ -f "${plugin_dir}package.json" ]; then
                echo "========================================"
                echo "Running plugin tests: ${plugin_name} (Bun)"
                echo "========================================"

                if run_bun_tests "${plugin_dir}"; then
                    echo -e "${GREEN}✓ ${plugin_name} (Bun) tests passed${NC}"
                else
                    echo -e "${RED}✗ ${plugin_name} (Bun) tests failed${NC}"
                    FAILED_TESTS+=("${plugin_name} (Bun) tests")
                    FAILED_PLUGINS+=("${plugin_name}")
                fi
            else
                echo -e "${YELLOW}⚠ ${plugin_name} has runtime 'bun' but no package.json, skipping${NC}"
            fi
            ;;
        bash|*)
            if [ -d "${plugin_dir}tests" ]; then
                echo "========================================"
                echo "Running plugin tests: ${plugin_name} (Bash)"
                echo "========================================"

                if run_bash_tests "${plugin_dir}tests"; then
                    echo -e "${GREEN}✓ ${plugin_name} (Bash) tests passed${NC}"
                else
                    echo -e "${RED}✗ ${plugin_name} (Bash) tests failed${NC}"
                    FAILED_TESTS+=("${plugin_name} (Bash) tests")
                    FAILED_PLUGINS+=("${plugin_name}")
                fi
            fi
            ;;
    esac
}

# Main execution
main() {
    echo -e "${YELLOW}Running all tests...${NC}"
    echo ""

    # 1. Run root tests
    run_tests "${SCRIPT_DIR}" "Root tests"

    # 2. Run plugin tests
    for plugin_dir in "${PROJECT_ROOT}"/plugins/*/; do
        if [ -d "${plugin_dir}" ]; then
            run_plugin_tests "${plugin_dir}"
        fi
    done

    # 3. Report results
    echo ""
    echo "========================================"
    echo "Test Results Summary"
    echo "========================================"

    if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed:${NC}"
        for failed_test in "${FAILED_TESTS[@]}"; do
            echo "  - ${failed_test}"
        done
        echo ""
        echo -e "${RED}Failed plugins: ${FAILED_PLUGINS[*]}${NC}"
        exit 1
    fi
}

# Run main function
main "$@"
