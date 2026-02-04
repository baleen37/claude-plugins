#!/usr/bin/env bash
# BATS test helpers for Baleen Claude Plugins

# Project root directory
# When loaded from node_modules via BATS_LIB_PATH, we need to find the project root
# shellcheck disable=SC2155
if [ -f "${BATS_TEST_DIRNAME}/../../helpers/bats_helper.bash" ]; then
    # Running from tests/ directory (legacy)
    export PROJECT_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
elif [ -f "${BATS_TEST_DIRNAME}/../../../tests/helpers/bats_helper.bash" ]; then
    # Running from plugins/{plugin}/tests/ directory
    # Need to go up 4 levels: tests/ -> plugin/ -> plugins/ -> project_root
    export PROJECT_ROOT="$(cd "${BATS_TEST_DIRNAME}/../../.." && pwd)"
else
    # Fallback: use script location (when loaded from node_modules)
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    # Navigate from packages/bats-helpers/src to project root
    export PROJECT_ROOT="$(cd "${script_dir}/../../.." && pwd)"
fi

# Path to jq binary
JQ_BIN="${JQ_BIN:-jq}"

# Setup function - runs before each test
# shellcheck disable=SC2155
setup() {
    # Create temp directory for test-specific files
    export TEST_TEMP_DIR=$(mktemp -d -t claude-plugins-test.XXXXXX)
}

# Teardown function - runs after each test
teardown() {
    # Clean up temp directory
    if [ -n "${TEST_TEMP_DIR:-}" ] && [ -d "$TEST_TEMP_DIR" ]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

# Helper: Check if jq is available
ensure_jq() {
    if ! command -v "$JQ_BIN" &> /dev/null; then
        skip "jq not available"
    fi
}

# Helper: Validate JSON file
validate_json() {
    local file="$1"
    if ! $JQ_BIN empty "$file" 2>/dev/null; then
        echo "Error: Invalid JSON in $file" >&2
        $JQ_BIN empty "$file" >&2
        return 1
    fi
}

# Helper: Check if file has valid frontmatter delimiter
has_frontmatter_delimiter() {
    local file="$1"
    local content
    content=$(head -1 "$file")
    [[ "$content" == "---" ]]
}

# Helper: Check if file has frontmatter field
has_frontmatter_field() {
    local file="$1"
    local field="$2"
    grep -q "^${field}:" "$file"
}
