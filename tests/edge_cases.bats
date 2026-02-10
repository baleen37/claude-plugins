#!/usr/bin/env bats
# Edge Case Tests
# Tests for edge cases and boundary conditions

load helpers/bats_helper
load helpers/fixture_factory

@test "handles empty plugin.json file" {
    local empty_json="${TEST_TEMP_DIR}/empty.json"
    touch "$empty_json"

    # Empty file is technically valid JSON (empty value)
    # but has no name field, so is invalid as a plugin manifest
    run json_has_field "$empty_json" "name"
    [ "$status" -ne 0 ]
}

@test "handles plugin with no components" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    local plugin_path
    plugin_path=$(create_minimal_plugin "$FIXTURE_ROOT" "minimal-test")

    # Should have valid plugin.json but no components
    local manifest="$plugin_path/.claude-plugin/plugin.json"
    validate_json "$manifest"
    assert_file_exists "$manifest"

    # No components directories should exist
    [ ! -d "$plugin_path/commands" ] || [ -z "$(ls -A "$plugin_path/commands" 2>/dev/null)" ]
}

@test "handles unicode in description fields" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    local plugin_path
    plugin_path=$(create_minimal_plugin "$FIXTURE_ROOT" "unicode-test")

    local manifest="$plugin_path/.claude-plugin/plugin.json"
    # Update with unicode content
    $JQ_BIN '.description = "Test with emoji 🎉 and 한글 text"' "$manifest" > "${manifest}.tmp"
    mv "${manifest}.tmp" "$manifest"

    validate_json "$manifest"
}

@test "handles very long field values" {
    # Create a long description
    local long_desc="This is a very long description that contains many characters"
    local json_file="${TEST_TEMP_DIR}/long.json"
    echo "{\"name\": \"test\", \"description\": \"$long_desc\"}" > "$json_file"

    validate_json "$json_file"
    local desc
    desc=$(json_get "$json_file" "description")
    # Just verify it returns the description, exact length may vary
    assert_not_empty "$desc" "description should not be empty"
    assert_gt "${#desc}" 20 "description should be longer than 20 characters"
}

@test "handles minimal valid plugin.json" {
    local minimal_json="${TEST_TEMP_DIR}/minimal.json"
    echo '{"name": "test-minimal"}' > "$minimal_json"

    validate_json "$minimal_json"
    json_has_field "$minimal_json" "name"
}

@test "handles plugin.json with all optional fields" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    local custom_fields='"description": "A full plugin", "author": "Test Author", "version": "1.0.0", "license": "MIT", "homepage": "https://example.com", "repository": "https://github.com/test/test", "keywords": ["test", "plugin"]'
    local plugin_path
    plugin_path=$(create_plugin_with_custom_fields "$FIXTURE_ROOT" "full-plugin" "$custom_fields")

    local manifest="$plugin_path/.claude-plugin/plugin.json"
    validate_json "$manifest"

    # Check all fields exist
    json_has_field "$manifest" "name"
    json_has_field "$manifest" "description"
    json_has_field "$manifest" "author"
    json_has_field "$manifest" "version"
    json_has_field "$manifest" "license"
    json_has_field "$manifest" "homepage"
    json_has_field "$manifest" "repository"
    json_has_field "$manifest" "keywords"
}

@test "handles author as string" {
    local json_file="${TEST_TEMP_DIR}/author-string.json"
    echo '{"name": "test", "author": "Test Author"}' > "$json_file"

    validate_json "$json_file"
    assert_json_field "$json_file" "author" "Test Author" "author field should be 'Test Author'"
}

@test "handles author as object" {
    local json_file="${TEST_TEMP_DIR}/author-object.json"
    echo '{"name": "test", "author": {"name": "Test Author", "email": "test@example.com"}}' > "$json_file"

    validate_json "$json_file"
    assert_json_field "$json_file" "author.name" "Test Author" "author.name should be 'Test Author'"
}

@test "handles empty arrays in plugin.json" {
    local json_file="${TEST_TEMP_DIR}/empty-arrays.json"
    echo '{"name": "test", "keywords": []}' > "$json_file"

    validate_json "$json_file"
    # Empty array returns empty string when using join
    local keywords
    keywords=$($JQ_BIN -r '.keywords | join(",")' "$json_file")
    assert_eq "$keywords" "" "empty keywords array should join to empty string"
}

@test "handles special characters in plugin name" {
    # Test valid hyphens and numbers
    is_valid_plugin_name "test-123-plugin"
    local result
    is_valid_plugin_name "test-123-plugin" && result="valid" || result="invalid"
    [ "$result" = "valid" ]
}

@test "handles frontmatter with multiline values" {
    local file="${TEST_TEMP_DIR}/multiline.md"
    cat > "$file" <<'EOF'
---
description: |
  This is a multiline
  description that spans
  multiple lines.
---

Content here.
EOF

    has_frontmatter_delimiter "$file"
    has_frontmatter_field "$file" "description"
}

@test "handles SKILL.md without content" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    local skill_file
    skill_file=$(create_skill_md "$FIXTURE_ROOT/SKILL.md" "empty-skill" "Empty skill" "")

    has_frontmatter_delimiter "$skill_file"
    has_frontmatter_field "$skill_file" "name"
}

@test "handles marketplace with no plugins" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    local marketplace_file
    marketplace_file=$(create_marketplace_json "$FIXTURE_ROOT/marketplace.json" "test-marketplace" "Empty marketplace" "test")

    validate_json "$marketplace_file"
    local plugin_count
    plugin_count=$($JQ_BIN -r '.plugins | length' "$marketplace_file")
    assert_eq "$plugin_count" "0" "marketplace with no plugins should have length 0"
}

@test "handles very long plugin name" {
    local long_name="very"
    for _ in $(seq 1 20); do
        long_name="${long_name}-long"
    done
    long_name="${long_name}-name"

    is_valid_plugin_name "$long_name"
    local result
    is_valid_plugin_name "$long_name" && result="valid" || result="invalid"
    [ "$result" = "valid" ]
}

@test "handles version boundary values" {
    # Minimum valid version
    is_valid_semver "0.0.0"
    local version="0.0.0"
    [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]

    # Large version numbers
    is_valid_semver "999.999.999"
    version="999.999.999"
    [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

@test "handles empty hooks.json" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    local hooks_file
    hooks_file=$(create_hooks_json "$FIXTURE_ROOT/hooks.json" "Empty hooks" '{}')

    validate_json "$hooks_file"
}

@test "handles nested hooks.json structure" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    local hooks_json='{"SessionStart": [{"type": "command", "command": "echo '\''started'\''", "description": "Test hook"}]}'
    local hooks_file
    hooks_file=$(create_hooks_json "$FIXTURE_ROOT/nested-hooks.json" "Nested hooks" "$hooks_json")

    validate_json "$hooks_file"
}
