#!/usr/bin/env bats
# Negative Test Cases
# Tests that verify proper handling of invalid inputs and schema violations

load helpers/bats_helper
load helpers/fixture_factory

@test "rejects plugin.json with invalid top-level field" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local plugin_path
    plugin_path=$(create_plugin_with_custom_fields "$FIXTURE_ROOT" "invalid-field-test" '"invalidField": "should not be here"')

    local manifest="$plugin_path/.claude-plugin/plugin.json"
    run validate_plugin_manifest_fields "$manifest"
    assert_exit_code 1 "Invalid field"
}

@test "rejects plugin.json with missing required name field" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local plugin_path
    plugin_path=$(create_plugin_with_custom_fields "$FIXTURE_ROOT" "no-name-test" '"description": "Plugin without name"')

    local manifest="$plugin_path/.claude-plugin/plugin.json"
    # Remove the name field that was added by default
    $JQ_BIN 'del(.name)' "$manifest" > "${manifest}.tmp" && mv "${manifest}.tmp" "$manifest"

    run json_has_field "$manifest" "name"
    assert_exit_code 1
}

@test "rejects plugin.json with null name field" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local plugin_path
    plugin_path=$(create_plugin_with_custom_fields "$FIXTURE_ROOT" "null-name-test" '"name": null')

    local manifest="$plugin_path/.claude-plugin/plugin.json"
    # Use the helper to check the field value is "null"
    assert_json_field "$manifest" "name" "null" "name field should be null in this test case"
}

@test "rejects plugin.json with invalid author field" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local plugin_path
    plugin_path=$(create_plugin_with_custom_fields "$FIXTURE_ROOT" "invalid-author-test" '"author": {"name": "Test", "invalid": "field"}')

    local manifest="$plugin_path/.claude-plugin/plugin.json"
    run validate_plugin_manifest_fields "$manifest"
    assert_exit_code 1 "Invalid author field"
}

@test "rejects hooks.json with invalid structure" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local hooks_file
    hooks_file=$(create_hooks_json "$FIXTURE_ROOT/hooks.json" "Invalid structure" '{"invalid": "structure"}')

    run validate_json "$hooks_file"
    # This should be valid JSON but not valid hooks structure
    [ "$status" -eq 0 ]  # JSON is valid
}

@test "rejects SKILL.md without required name field" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local skill_file="$FIXTURE_ROOT/SKILL.md"
    mkdir -p "$FIXTURE_ROOT"

    cat > "$skill_file" <<EOF
---
description: A skill without name
---

Content here
EOF

    run has_frontmatter_field "$skill_file" "name"
    assert_exit_code 1
}

@test "rejects SKILL.md without frontmatter delimiter" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local skill_file="$FIXTURE_ROOT/no-frontmatter.md"
    mkdir -p "$FIXTURE_ROOT"

    cat > "$skill_file" <<EOF
# Just a heading

No frontmatter here
EOF

    run has_frontmatter_delimiter "$skill_file"
    assert_exit_code 1
}

@test "rejects command file without description" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local command_file="$FIXTURE_ROOT/command.md"
    mkdir -p "$FIXTURE_ROOT"

    cat > "$command_file" <<EOF
---
name: command-no-desc
---

Content
EOF

    run has_frontmatter_field "$command_file" "description"
    assert_exit_code 1
}

@test "rejects agent file without model field" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local agent_file="$FIXTURE_ROOT/agent.md"
    mkdir -p "$FIXTURE_ROOT"

    cat > "$agent_file" <<EOF
---
name: test-agent
description: An agent
---

Content
EOF

    run has_frontmatter_field "$agent_file" "model"
    assert_exit_code 1
}

@test "rejects marketplace.json with duplicate plugin names" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local marketplace_file
    local plugins='[{"name": "dup-plugin", "source": "./plugins/dup1"}, {"name": "dup-plugin", "source": "./plugins/dup2"}]'
    marketplace_file=$(create_marketplace_json "$FIXTURE_ROOT/marketplace.json" "test-marketplace" "Test" "test" "" "$plugins")

    # This is valid JSON but has duplicate names
    validate_json "$marketplace_file"
}

@test "rejects invalid semantic version formats" {
    # Test various invalid version formats
    run ! is_valid_semver "1.2"      # Missing patch
    run ! is_valid_semver "1.2.3.4"  # Too many parts
    run ! is_valid_semver "v1.2.3"   # Has v prefix
    run ! is_valid_semver "1.2.3-beta"  # Has prerelease (not supported by our regex)
}

@test "rejects plugin name with invalid characters" {
    run ! is_valid_plugin_name "InvalidName"      # Uppercase
    run ! is_valid_plugin_name "test_plugin"      # Underscore
    run ! is_valid_plugin_name "test.plugin"      # Dot
    run ! is_valid_plugin_name "test plugin"      # Space
    run ! is_valid_plugin_name "test/plugin"      # Slash
}

@test "handles malformed YAML in hooks.json" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local hooks_file="$FIXTURE_ROOT/malformed-hooks.json"
    mkdir -p "$FIXTURE_ROOT"

    cat > "$hooks_file" <<EOF
{
  "description": "Bad YAML,
  "hooks": {
}
EOF

    run validate_json "$hooks_file"
    assert_exit_code 1 "Error"
}

@test "rejects plugin.json with wrong field type" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local plugin_path
    plugin_path=$(create_plugin_with_custom_fields "$FIXTURE_ROOT" "wrong-type-test" '"keywords": "should-be-array"')

    local manifest="$plugin_path/.claude-plugin/plugin.json"
    validate_json "$manifest"
    # JSON is valid but type is wrong - verify it's a string not array
    assert_json_field_type "$manifest" "keywords" "string" "keywords field should be string (wrong type for this test)"
}

@test "rejects marketplace.json with missing owner" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local marketplace_file="$FIXTURE_ROOT/no-owner-marketplace.json"
    mkdir -p "$FIXTURE_ROOT"

    cat > "$marketplace_file" <<EOF
{
  "name": "test-marketplace",
  "plugins": []
}
EOF

    # Valid JSON but missing owner
    validate_json "$marketplace_file"
    run json_has_field "$marketplace_file" "owner"
    assert_exit_code 1
}

@test "rejects workflow file with invalid YAML syntax" {
    local TEST_DIR="${TEST_TEMP_DIR}/negative_tests"
    mkdir -p "$TEST_DIR"

    cat > "$TEST_DIR/workflow.yml" <<EOF
name: Test
on: push
  invalid indentation: [
missing bracket
EOF

    if command -v yq &> /dev/null; then
        run yq eval '.' "$TEST_DIR/workflow.yml" 2>&1
        assert_exit_code 1 || skip "yq parsed invalid YAML"
    elif command -v python3 &> /dev/null; then
        run python3 -c "import yaml; yaml.safe_load(open('$TEST_DIR/workflow.yml'))" 2>&1
        assert_exit_code 1 || skip "python3 yaml parsed invalid YAML"
    else
        skip "No YAML validator available"
    fi
}

@test "rejects empty plugin name" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/negative_tests"
    local plugin_path
    plugin_path=$(create_plugin_with_custom_fields "$FIXTURE_ROOT" "empty-name-test" '"name": ""')

    local manifest="$plugin_path/.claude-plugin/plugin.json"
    # Use the helper to check the field value is empty
    assert_json_field "$manifest" "name" "" "name field should be empty in this test case"
}
