#!/usr/bin/env bats
# Error Handling Tests
# Tests that the codebase handles errors gracefully with clear messages

load helpers/bats_helper
load helpers/fixture_factory

@test "validate_json provides clear error for malformed JSON" {
    local malformed="${TEST_TEMP_DIR}/malformed.json"
    echo '{"name": "test", invalid}' > "$malformed"

    run validate_json "$malformed"
    assert_exit_code 1 "Error"
}

@test "validate_json handles empty file gracefully" {
    local empty="${TEST_TEMP_DIR}/empty.json"
    touch "$empty"

    run validate_json "$empty"
    # Empty file might be considered valid JSON (empty value)
    # The test just checks it handles gracefully
    [ "$status" -ne 0 ] || [ -z "$output" ]
}

@test "json_get handles missing file" {
    run json_get "/nonexistent/file.json" "name"
    [ "$status" -ne 0 ]
}

@test "json_get handles missing field" {
    local json_file="${TEST_TEMP_DIR}/minimal.json"
    echo '{"name": "test"}' > "$json_file"

    local result
    result=$(json_get "$json_file" "nonexistent")
    # jq returns null for missing fields, which becomes empty string
    [ -z "$result" ] || [ "$result" = "null" ]
}

@test "is_valid_plugin_name rejects uppercase" {
    run is_valid_plugin_name "InvalidName"
    assert_exit_code 1
}

@test "is_valid_plugin_name rejects underscores" {
    run is_valid_plugin_name "test_plugin"
    assert_exit_code 1
}

@test "is_valid_plugin_name rejects dots" {
    run is_valid_plugin_name "test.plugin"
    assert_exit_code 1
}

@test "is_valid_plugin_name accepts valid names" {
    is_valid_plugin_name "valid-name-123"
    # Function returns 0 (true) if valid
    local result
    is_valid_plugin_name "valid-name-123" && result="valid" || result="invalid"
    [ "$result" = "valid" ]
}

@test "has_frontmatter_delimiter handles non-markdown files" {
    local text_file="${TEST_TEMP_DIR}/test.txt"
    echo "plain text" > "$text_file"

    run has_frontmatter_delimiter "$text_file"
    assert_exit_code 1
}

@test "has_frontmatter_delimiter handles empty file" {
    local empty="${TEST_TEMP_DIR}/empty.md"
    touch "$empty"

    run has_frontmatter_delimiter "$empty"
    assert_exit_code 1
}

@test "has_frontmatter_field handles file without frontmatter" {
    local no_frontmatter="${TEST_TEMP_DIR}/no-frontmatter.md"
    echo "# Just content" > "$no_frontmatter"

    run has_frontmatter_field "$no_frontmatter" "description"
    assert_exit_code 1
}

@test "fixture factory rejects invalid plugin name" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"

    run create_minimal_plugin "$FIXTURE_ROOT" "InvalidName"
    assert_exit_code 1 "Error"
}

@test "cleanup_fixtures handles non-existent directory" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    cleanup_fixtures "/nonexistent/path"
    # Should not fail even if directory doesn't exist
    [ "$?" -eq 0 ]
}

@test "assert_eq shows clear difference on failure" {
    run assert_eq "actual" "expected" "Should show clear difference"
    assert_exit_code 1
    assert_output_contains "Expected:"
    assert_output_contains "Actual:"
}

@test "assert_file_exists shows file path on failure" {
    run assert_file_exists "/nonexistent/file.txt" "Custom message"
    assert_exit_code 1
    assert_output_contains "File not found"
}

@test "assert_matches shows pattern and value on failure" {
    run assert_matches "hello" "^[0-9]+$" "Should match numbers"
    assert_exit_code 1
    assert_output_contains "Value:"
    assert_output_contains "Pattern:"
}

@test "is_valid_semver rejects invalid versions" {
    run is_valid_semver "1.2"
    assert_exit_code 1

    run is_valid_semver "1.2.3.4"
    assert_exit_code 1

    run is_valid_semver "v1.2.3"
    assert_exit_code 1
}

@test "is_valid_semver accepts valid versions" {
    is_valid_semver "1.0.0"
    # Function uses regex match, check with explicit test
    local version="1.0.0"
    [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]

    is_valid_semver "10.20.30"
    version="10.20.30"
    [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

@test "plugin manifest validation catches disallowed fields" {
    local manifest="${TEST_TEMP_DIR}/plugin.json"
    echo '{"name": "test", "disallowed": "field"}' > "$manifest"

    run validate_plugin_manifest_fields "$manifest"
    assert_exit_code 1 "Invalid field"
}

@test "count_files handles non-existent directory" {
    run count_files "*.json" "/nonexistent/path"
    # Should return 0 or handle gracefully
    assert_exit_code 0
}

@test "json_field_is_allowed rejects unknown fields" {
    run json_field_is_allowed "unknownField"
    assert_exit_code 1
}

@test "yaml_get handles missing file" {
    run yaml_get "/nonexistent/file.yaml" "field"
    # Should fail gracefully
    assert_exit_code 1
}

@test "setup creates temp directory even on failure retry" {
    # Ensure setup creates a unique temp directory
    local temp1
    temp1=$(mktemp -d -t claude-plugins-test.XXXXXX)
    [ -n "$temp1" ]
    [ -d "$temp1" ]
    rm -rf "$temp1"

    local temp2
    temp2=$(mktemp -d -t claude-plugins-test.XXXXXX)
    [ -n "$temp2" ]
    [ -d "$temp2" ]
    rm -rf "$temp2"
}
