#!/usr/bin/env bash
# run-unit-tests.sh: Run unit tests only (fast tests for pre-commit)
#
# This script runs unit tests in the project:
# - Excludes integration/, performance/, handoff/, skills/ subdirectories
# - Excludes plugin tests
# - Runs sequentially (no parallel execution) for better performance
#
# Exit code: 0 if all tests pass, 1 if any test fails

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Track failures
FAILED_TESTS=()

# Function to run bats tests
run_tests() {
    local test_files=("$@")
    local label="Unit tests"

    if [ ${#test_files[@]} -eq 0 ]; then
        echo -e "${YELLOW}No unit tests found${NC}"
        exit 0
    fi

    echo "========================================"
    echo "Running ${label}..."
    echo "  (${#test_files[@]} test files)"
    echo "========================================"

    if bats "${test_files[@]}"; then
        echo -e "${GREEN}✓ ${label} passed${NC}"
        return 0
    else
        echo -e "${RED}✗ ${label} failed${NC}"
        FAILED_TESTS+=("${label}")
        return 1
    fi
}

# Main execution
main() {
    echo -e "${YELLOW}Running unit tests...${NC}"
    echo ""

    # Collect unit test files (exclude integration/, performance/, handoff/, skills/)
    local test_files=()
    while IFS= read -r -d '' file; do
        test_files+=("$file")
    done < <(find "${SCRIPT_DIR}" -maxdepth 1 -name "*.bats" -print0)

    # Run unit tests
    run_tests "${test_files[@]}"

    # Report results
    echo ""
    echo "========================================"
    echo "Test Results Summary"
    echo "========================================"

    if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
        echo -e "${GREEN}All unit tests passed!${NC}"
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
