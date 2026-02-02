#!/usr/bin/env bash
# bats-core test helper for claude-plugins project

# Project root directory
# BATS_TEST_DIRNAME is the directory containing the test file
# We need to find the project root from wherever the test is running
if [ -f "${BATS_TEST_DIRNAME}/../../helpers/bats_helper.bash" ]; then
    # Running from tests/ directory (legacy)
    export PROJECT_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
elif [ -f "${BATS_TEST_DIRNAME}/../../../tests/helpers/bats_helper.bash" ]; then
    # Running from plugins/{plugin}/tests/ directory
    # Need to go up 4 levels: tests/ -> plugin/ -> plugins/ -> project_root
    export PROJECT_ROOT="$(cd "${BATS_TEST_DIRNAME}/../../.." && pwd)"
else
    # Fallback: use script location (resolve symlinks)
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    script_name="$(basename "${BASH_SOURCE[0]}")"
    # Resolve symlink if present (macOS compatible)
    if [ -L "${script_dir}/${script_name}" ]; then
        resolved="$(cd "${script_dir}" && \
                   cd "$(dirname "$(readlink "${script_dir}/${script_name}")")" && \
                   cd "../.." && pwd)"
        export PROJECT_ROOT="$resolved"
    elif [ -L "${script_dir}/${script_name}.bash" ]; then
        # Handle case where script_name doesn't have .bash but the link does
        resolved="$(cd "${script_dir}" && \
                   cd "$(dirname "$(readlink "${script_dir}/${script_name}.bash")")" && \
                   cd "../.." && pwd)"
        export PROJECT_ROOT="$resolved"
    else
        export PROJECT_ROOT="$(cd "${script_dir}/../.." && pwd)"
    fi
fi

# Path to jq binary
JQ_BIN="${JQ_BIN:-jq}"

# Setup function - runs before each test
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

# Helper: Check if JSON field exists
json_has_field() {
    local file="$1"
    local field="$2"
    $JQ_BIN -e ".$field" "$file" &> /dev/null
}

# Helper: Get JSON field value
json_get() {
    local file="$1"
    local field="$2"
    $JQ_BIN -r ".$field" "$file"
}

# Helper: Check plugin name format (lowercase, hyphens, numbers only)
is_valid_plugin_name() {
    local name="$1"
    [[ "$name" =~ ^[a-z0-9-]+$ ]]
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

# Helper: Count files matching pattern
count_files() {
    local pattern="$1"
    local base_dir="${2:-.}"
    find "$base_dir" -name "$pattern" -type f 2>/dev/null | wc -l | tr -d ' '
}

# Helper: Check if JSON field is allowed in plugin.json
# Claude Code only supports: name, description, author, version, license, homepage, repository, keywords
json_field_is_allowed() {
    local field="$1"
    local allowed_fields="name description author version license homepage repository keywords"
    [[ " $allowed_fields " =~ " $field " ]]
}

# Helper: Check if author field is allowed (author.name, author.email)
json_author_field_is_allowed() {
    local field="$1"
    local allowed_author_fields="name email"
    [[ " $allowed_author_fields " =~ " $field " ]]
}

# Helper: Validate plugin.json has only allowed fields
validate_plugin_manifest_fields() {
    local file="$1"
    local all_fields
    all_fields=$($JQ_BIN -r 'keys_unsorted[]' "$file" 2>/dev/null)

    while IFS= read -r field; do
        if ! json_field_is_allowed "$field"; then
            echo "Error: Invalid field '$field' in $file"
            echo "Allowed fields: name, description, author, version, license, homepage, repository, keywords"
            return 1
        fi
    done <<< "$all_fields"

    # Check nested author fields
    if $JQ_BIN -e '.author' "$file" &>/dev/null; then
        local author_fields
        author_fields=$($JQ_BIN -r '.author | keys_unsorted[]' "$file" 2>/dev/null)

        while IFS= read -r field; do
            if ! json_author_field_is_allowed "$field"; then
                echo "Error: Invalid author field 'author.$field' in $file"
                echo "Allowed author fields: name, email"
                return 1
            fi
        done <<< "$author_fields"
    fi

    return 0
}

# Helper: Iterate over all plugin manifest files
# Usage: for_each_plugin_manifest callback_function
for_each_plugin_manifest() {
    local callback="$1"
    local manifest_files
    manifest_files=$(find "$PROJECT_ROOT/plugins" -name "plugin.json" -type f 2>/dev/null)

    [ -n "$manifest_files" ] || return 1

    while IFS= read -r manifest_file; do
        $callback "$manifest_file"
    done <<< "$manifest_files"
}

# Helper: Check if JSON field has specific type
json_field_has_type() {
    local file="$1"
    local field="$2"
    local expected_type="$3"
    local actual_type
    actual_type=$($JQ_BIN -r ".$field | type" "$file" 2>/dev/null)
    [ "$actual_type" = "$expected_type" ]
}

# Helper: Validate semver format (major.minor.patch)
is_valid_semver() {
    local version="$1"
    [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

# Helper: Assert with custom error message
# Usage: assert_eq <actual> <expected> <message>
assert_eq() {
    local actual="$1"
    local expected="$2"
    local message="${3:-Values should be equal}"

    if [ "$actual" != "$expected" ]; then
        echo "Assertion failed: $message" >&2
        echo "  Expected: $expected" >&2
        echo "  Actual:   $actual" >&2
        return 1
    fi
}

# Helper: Assert not empty with custom error message
# Usage: assert_not_empty <value> <message>
assert_not_empty() {
    local value="$1"
    local message="${2:-Value should not be empty}"

    if [ -z "$value" ]; then
        echo "Assertion failed: $message" >&2
        echo "  Value is empty" >&2
        return 1
    fi
}

# Helper: Assert file exists with custom error message
# Usage: assert_file_exists <path> <message>
assert_file_exists() {
    local path="$1"
    local message="${2:-File should exist}"

    if [ ! -f "$path" ]; then
        echo "Assertion failed: $message" >&2
        echo "  File not found: $path" >&2
        return 1
    fi
}

# Helper: Assert directory exists with custom error message
# Usage: assert_dir_exists <path> <message>
assert_dir_exists() {
    local path="$1"
    local message="${2:-Directory should exist}"

    if [ ! -d "$path" ]; then
        echo "Assertion failed: $message" >&2
        echo "  Directory not found: $path" >&2
        return 1
    fi
}

# Helper: Assert matches regex with custom error message
# Usage: assert_matches <value> <regex> <message>
assert_matches() {
    local value="$1"
    local regex="$2"
    local message="${3:-Value should match pattern}"

    if [[ ! "$value" =~ $regex ]]; then
        echo "Assertion failed: $message" >&2
        echo "  Value:    $value" >&2
        echo "  Pattern:  $regex" >&2
        return 1
    fi
}
