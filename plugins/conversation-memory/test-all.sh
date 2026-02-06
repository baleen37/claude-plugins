#!/usr/bin/env bash
#
# Unified test runner for conversation-memory plugin
# Runs both Bun-compatible tests and vitest-specific tests
#
# Usage:
#   ./test-all.sh              # Run all tests
#   ./test-all.sh bun-only     # Run only Bun tests
#   ./test-all.sh vitest-only  # Run only vitest tests

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Test counters
BUN_TESTS_PASSED=0
BUN_TESTS_FAILED=0
VITEST_TESTS_PASSED=0
VITEST_TESTS_FAILED=0
TOTAL_EXIT_CODE=0

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Print section header
print_header() {
    local text="$1"
    echo -e "\n${BLUE}=== $text ===${NC}"
    echo -e "${BLUE}$(printf '=%.0s' {1..80})${NC}\n"
}

# Print success message
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Print error message
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Print warning message
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Run Bun tests
run_bun_tests() {
    print_header "Running Bun Tests"

    if ! command_exists bun; then
        print_error "bun is not installed or not in PATH"
        return 1
    fi

    local bun_start_time
    bun_start_time=$(date +%s)

    # List of Bun-compatible test files
    # These files import from 'bun:test' and can run with Bun
    local bun_test_files=(
        "src/cli/search-cli.test.ts"
        "src/cli/show-cli.test.ts"
        "src/cli/stats-cli.test.ts"
        "src/cli/sync-cli.test.ts"
        "src/core/embeddings.test.ts"
        "src/core/indexer.test.ts"
        "src/core/parser.test.ts"
        "src/core/paths.test.ts"
        "src/core/search.test.ts"
        "src/core/show.test.ts"
        "src/core/summarizer.test.ts"
        "src/core/sync.test.ts"
        "src/mcp/server.test.ts"
    )

    # Build the list of existing test files
    local test_args=()
    for file in "${bun_test_files[@]}"; do
        local full_path="${SCRIPT_DIR}/${file}"
        if [[ -f "$full_path" ]]; then
            test_args+=("$full_path")
        fi
    done

    if [[ ${#test_args[@]} -eq 0 ]]; then
        print_warning "No Bun test files found"
        return 0
    fi

    # Run bun test with specific files and capture output
    local bun_exit_code=0
    if bun test "${test_args[@]}" 2>&1 | tee /tmp/bun-test-output.log; then
        bun_exit_code=0
    else
        bun_exit_code=$?
    fi

    local bun_end_time
    bun_end_time=$(date +%s)
    local bun_duration=$((bun_end_time - bun_start_time))

    # Parse bun test output for summary
    if [[ $bun_exit_code -eq 0 ]]; then
        print_success "Bun tests passed in ${bun_duration}s"
        BUN_TESTS_PASSED=1
    else
        print_error "Bun tests failed in ${bun_duration}s"
        export BUN_TESTS_FAILED=1
        TOTAL_EXIT_CODE=1
    fi

    # Try to extract test count from output
    if grep -q "pass" /tmp/bun-test-output.log 2>/dev/null; then
        echo ""
        grep -E "(pass|fail)" /tmp/bun-test-output.log | tail -5 || true
    fi
}

# Run vitest tests
run_vitest_tests() {
    print_header "Running Vitest Tests"

    local vitest_files=(
        "src/core/db.test.ts"
        "src/core/stats.test.ts"
    )

    local vitest_args=()
    for file in "${vitest_files[@]}"; do
        if [[ -f "${SCRIPT_DIR}/${file}" ]]; then
            vitest_args+=("${SCRIPT_DIR}/${file}")
        else
            print_warning "Test file not found: ${file}"
        fi
    done

    if [[ ${#vitest_args[@]} -eq 0 ]]; then
        print_warning "No vitest test files found"
        return 0
    fi

    # Check if vitest is available
    if ! command_exists vitest && ! command_exists npx; then
        print_error "Neither vitest nor npx is available"
        return 1
    fi

    local vitest_start_time
    vitest_start_time=$(date +%s)

    # Run vitest and capture output
    local vitest_cmd="vitest"
    if ! command_exists vitest; then
        vitest_cmd="npx vitest"
    fi

    if $vitest_cmd run "${vitest_args[@]}" 2>&1 | tee /tmp/vitest-test-output.log; then
        VITEST_EXIT_CODE=0
    else
        VITEST_EXIT_CODE=$?
    fi

    local vitest_end_time
    vitest_end_time=$(date +%s)
    local vitest_duration=$((vitest_end_time - vitest_start_time))

    # Parse vitest output for summary
    if [[ $VITEST_EXIT_CODE -eq 0 ]]; then
        print_success "Vitest tests passed in ${vitest_duration}s"
        VITEST_TESTS_PASSED=1
    else
        print_error "Vitest tests failed in ${vitest_duration}s"
        export VITEST_TESTS_FAILED=1
        TOTAL_EXIT_CODE=1
    fi
}

# Print final summary
print_summary() {
    print_header "Test Summary"

    local bun_status
    local vitest_status

    if [[ $BUN_TESTS_PASSED -eq 1 ]]; then
        bun_status="${GREEN}PASSED${NC}"
    else
        bun_status="${RED}FAILED${NC}"
    fi

    if [[ $VITEST_TESTS_PASSED -eq 1 ]]; then
        vitest_status="${GREEN}PASSED${NC}"
    else
        vitest_status="${RED}FAILED${NC}"
    fi

    echo -e "Bun Tests:    ${bun_status}"
    echo -e "Vitest Tests: ${vitest_status}"
    echo ""

    if [[ $TOTAL_EXIT_CODE -eq 0 ]]; then
        print_success "All tests passed!"
    else
        print_error "Some tests failed. Check the output above for details."
    fi

    echo ""
}

# Main execution
main() {
    local run_mode="${1:-all}"

    case "$run_mode" in
        bun-only)
            print_header "Bun Tests Only Mode"
            run_bun_tests
            ;;
        vitest-only)
            print_header "Vitest Tests Only Mode"
            run_vitest_tests
            ;;
        all|"")
            print_header "Running All Tests"
            run_bun_tests
            run_vitest_tests
            print_summary
            ;;
        *)
            print_error "Unknown mode: $run_mode"
            echo "Usage: $0 [all|bun-only|vitest-only]"
            exit 1
            ;;
    esac

    exit $TOTAL_EXIT_CODE
}

# Run main
main "$@"
