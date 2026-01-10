#!/usr/bin/env bash
# bats-core test helper for claude-plugins project

# Project root directory
# BATS_TEST_DIRNAME is the directory containing the test file (tests/)
# So we need to go up one level to get to project root
export PROJECT_ROOT="${BATS_TEST_DIRNAME}/.."

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
    $JQ_BIN empty "$file" 2>/dev/null
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
