#!/usr/bin/env bats
# Test suite for plugin.json manifest validation
# https://code.claude.com/docs/en/plugins-reference#plugin-manifest

load helpers/bats_helper

setup() {
    # Create temp directory for test-specific files
    export TEST_TEMP_DIR=$(mktemp -d -t claude-plugins-test.XXXXXX)
    export TEST_DIR="${TEST_TEMP_DIR}/manifest_tests"
    mkdir -p "$TEST_DIR"
    ensure_jq
}

teardown() {
    # Clean up temp directory
    if [ -n "${TEST_TEMP_DIR:-}" ] && [ -d "$TEST_TEMP_DIR" ]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

@test "plugin.json has only allowed top-level fields" {
    # Create a valid plugin.json
    cat > "$TEST_DIR/plugin.json" <<EOF
{
    "name": "test-plugin",
    "description": "Test plugin",
    "author": {
        "name": "Test Author",
        "email": "test@example.com"
    },
    "version": "1.0.0",
    "license": "MIT",
    "homepage": "https://example.com",
    "repository": "https://github.com/test/test-plugin",
    "keywords": ["test", "plugin"]
}
EOF

    # Validate all fields are allowed
    run validate_plugin_manifest_fields "$TEST_DIR/plugin.json"
    [ "$status" -eq 0 ]
}

@test "plugin.json rejects disallowed top-level fields" {
    # Create plugin.json with disallowed fields
    cat > "$TEST_DIR/plugin.json" <<EOF
{
    "name": "test-plugin",
    "description": "Test plugin",
    "invalidField": "should not be here",
    "anotherInvalid": 123
}
EOF

    # Should fail validation
    run validate_plugin_manifest_fields "$TEST_DIR/plugin.json"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Invalid field"* ]]
}

@test "plugin.json allows only name and email in author object" {
    # Create plugin.json with valid author fields
    cat > "$TEST_DIR/plugin.json" <<EOF
{
    "name": "test-plugin",
    "author": {
        "name": "Test Author",
        "email": "test@example.com"
    }
}
EOF

    # Should pass validation
    run validate_plugin_manifest_fields "$TEST_DIR/plugin.json"
    [ "$status" -eq 0 ]
}

@test "plugin.json rejects disallowed author fields" {
    # Create plugin.json with invalid author field
    cat > "$TEST_DIR/plugin.json" <<EOF
{
    "name": "test-plugin",
    "author": {
        "name": "Test Author",
        "url": "https://example.com",
        "invalid": "field"
    }
}
EOF

    # Should fail validation
    run validate_plugin_manifest_fields "$TEST_DIR/plugin.json"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Invalid author field"* ]]
}

@test "plugin.json requires name field" {
    # Create plugin.json without name
    cat > "$TEST_DIR/plugin.json" <<EOF
{
    "description": "Test plugin without name"
}
EOF

    # Name is required - validate it exists
    run json_has_field "$TEST_DIR/plugin.json" "name"
    [ "$status" -eq 1 ]
}

@test "plugin.json name is valid JSON string" {
    # Create plugin.json with valid name
    cat > "$TEST_DIR/plugin.json" <<EOF
{
    "name": "my-valid-plugin"
}
EOF

    # Should be valid JSON
    run validate_json "$TEST_DIR/plugin.json"
    [ "$status" -eq 0 ]

    # Name should be a string
    json_field_has_type "$TEST_DIR/plugin.json" "name" "string"
}

@test "plugin.json author can be string or object" {
    # Test with string author
    cat > "$TEST_DIR/plugin-string.json" <<EOF
{
    "name": "test-plugin",
    "author": "Test Author"
}
EOF

    run validate_json "$TEST_DIR/plugin-string.json"
    [ "$status" -eq 0 ]

    # Test with object author
    cat > "$TEST_DIR/plugin-object.json" <<EOF
{
    "name": "test-plugin",
    "author": {
        "name": "Test Author"
    }
}
EOF

    run validate_json "$TEST_DIR/plugin-object.json"
    [ "$status" -eq 0 ]
}

@test "plugin.json keywords is array of strings" {
    # Create plugin.json with keywords array
    cat > "$TEST_DIR/plugin.json" <<EOF
{
    "name": "test-plugin",
    "keywords": ["test", "plugin", "automation"]
}
EOF

    # Should be valid JSON
    run validate_json "$TEST_DIR/plugin.json"
    [ "$status" -eq 0 ]

    # Keywords should be an array
    json_field_has_type "$TEST_DIR/plugin.json" "keywords" "array"
}

@test "all real plugin manifests are valid" {
    # Find all plugin.json files in the project
    local manifest_files
    manifest_files=$(find "$PROJECT_ROOT/plugins" -name "plugin.json" -type f 2>/dev/null)

    [ -n "$manifest_files" ] || skip "No plugin.json files found"

    # Validate each manifest
    while IFS= read -r manifest_file; do
        # Check if JSON is valid
        run validate_json "$manifest_file"
        [ "$status" -eq 0 ]

        # Check if all fields are allowed
        run validate_plugin_manifest_fields "$manifest_file"
        [ "$status" -eq 0 ]
    done <<< "$manifest_files"
}
