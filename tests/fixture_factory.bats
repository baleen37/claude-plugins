#!/usr/bin/env bats
# Test: Fixture Factory for creating test fixtures

load helpers/bats_helper
load helpers/fixture_factory

@test "create_minimal_plugin creates minimal plugin structure" {
    local plugin_name="test-minimal-plugin"
    local plugin_path
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"

    # Create minimal plugin
    plugin_path=$(create_minimal_plugin "$FIXTURE_ROOT" "$plugin_name")

    # Verify directory exists
    [ -d "$plugin_path" ]

    # Verify plugin.json exists and is valid JSON
    local manifest="$plugin_path/.claude-plugin/plugin.json"
    [ -f "$manifest" ]
    validate_json "$manifest"

    # Verify required fields
    json_has_field "$manifest" "name"
    json_has_field "$manifest" "description"
    json_has_field "$manifest" "author"
    json_has_field "$manifest" "version"

    # Verify values
    local name
    name=$(json_get "$manifest" "name")
    [ "$name" = "$plugin_name" ]

    local version
    version=$(json_get "$manifest" "version")
    [ "$version" = "1.0.0" ]
}

@test "create_minimal_plugin validates plugin name format" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"

    # Invalid name with uppercase
    run create_minimal_plugin "$FIXTURE_ROOT" "InvalidName"

    [ "$status" -ne 0 ]
    [[ "$output" =~ "invalid" || "$output" =~ "Invalid" ]]
}

@test "create_full_plugin creates complete plugin structure" {
    local plugin_name="test-full-plugin"
    local plugin_path
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"

    # Create full plugin
    plugin_path=$(create_full_plugin "$FIXTURE_ROOT" "$plugin_name")

    # Verify directory structure
    [ -d "$plugin_path/commands" ]
    [ -d "$plugin_path/agents" ]
    [ -d "$plugin_path/skills" ]
    [ -d "$plugin_path/hooks" ]

    # Verify plugin.json
    local manifest="$plugin_path/.claude-plugin/plugin.json"
    [ -f "$manifest" ]
    validate_json "$manifest"

    # Verify all required fields
    json_has_field "$manifest" "name"
    json_has_field "$manifest" "description"
    json_has_field "$manifest" "author"
    json_has_field "$manifest" "version"
    json_has_field "$manifest" "license"
    json_has_field "$manifest" "keywords"

    # Verify sample files exist
    [ -f "$plugin_path/commands/example-command.md" ]
    [ -f "$plugin_path/agents/example-agent.md" ]
    [ -f "$plugin_path/skills/example-skill/SKILL.md" ]
    [ -f "$plugin_path/hooks/hooks.json" ]
}

@test "create_command_file creates valid command file" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    local plugin_path="$FIXTURE_ROOT/test-command-plugin"
    mkdir -p "$plugin_path/commands"

    # Create command file
    create_command_file "$plugin_path/commands" "test-command" "Test command description"

    local command_file="$plugin_path/commands/test-command.md"
    [ -f "$command_file" ]

    # Verify frontmatter delimiter
    has_frontmatter_delimiter "$command_file"

    # Verify description field
    has_frontmatter_field "$command_file" "description"

    # Verify content after frontmatter
    grep -q "Content for test-command" "$command_file"
}

@test "create_agent_file creates valid agent file" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    local plugin_path="$FIXTURE_ROOT/test-agent-plugin"
    mkdir -p "$plugin_path/agents"

    # Create agent file
    create_agent_file "$plugin_path/agents" "test-agent" "Test agent description" "sonnet"

    local agent_file="$plugin_path/agents/test-agent.md"
    [ -f "$agent_file" ]

    # Verify frontmatter delimiter
    has_frontmatter_delimiter "$agent_file"

    # Verify required fields
    has_frontmatter_field "$agent_file" "name"
    has_frontmatter_field "$agent_file" "description"
    has_frontmatter_field "$agent_file" "model"

    # Verify model value
    grep "^model: sonnet" "$agent_file"
}

@test "create_skill_file creates valid skill structure" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    local plugin_path="$FIXTURE_ROOT/test-skill-plugin"
    mkdir -p "$plugin_path/skills"

    # Create skill file
    create_skill_file "$plugin_path/skills" "test-skill" "Test skill description"

    local skill_dir="$plugin_path/skills/test-skill"
    local skill_file="$skill_dir/SKILL.md"

    [ -d "$skill_dir" ]
    [ -f "$skill_file" ]

    # Verify frontmatter delimiter
    has_frontmatter_delimiter "$skill_file"

    # Verify required fields
    has_frontmatter_field "$skill_file" "name"
    has_frontmatter_field "$skill_file" "description"

    # Verify content structure - check for heading (regardless of capitalization)
    grep -q "^# " "$skill_file"
    grep -q "## Overview" "$skill_file"
}

@test "create_skill_file with content creates detailed skill" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    local plugin_path="$FIXTURE_ROOT/test-skill-content-plugin"
    mkdir -p "$plugin_path/skills"

    local content="# Overview
This is test content.

## Usage
Use this skill for testing."

    # Create skill file with content
    create_skill_file "$plugin_path/skills" "test-detailed-skill" "Test detailed skill" "$content"

    local skill_file="$plugin_path/skills/test-detailed-skill/SKILL.md"

    # Verify custom content
    grep -q "# Overview" "$skill_file"
    grep -q "This is test content" "$skill_file"
    grep -q "## Usage" "$skill_file"
}

@test "cleanup_fixtures removes all fixture directories" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    local plugin1
    local plugin2

    plugin1=$(create_minimal_plugin "$FIXTURE_ROOT" "cleanup-test-1")
    plugin2=$(create_full_plugin "$FIXTURE_ROOT" "cleanup-test-2")

    # Verify they exist
    [ -d "$plugin1" ]
    [ -d "$plugin2" ]

    # Clean up
    cleanup_fixtures "$FIXTURE_ROOT"

    # Verify they're gone
    [ ! -d "$plugin1" ]
    [ ! -d "$plugin2" ]
    [ ! -d "$FIXTURE_ROOT" ]
}

@test "cleanup_fixtures handles non-existent directory gracefully" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"
    local non_existent="$FIXTURE_ROOT/non-existent-path"

    # Should not fail even if directory doesn't exist
    run cleanup_fixtures "$non_existent"

    [ "$status" -eq 0 ]
}

@test "create_minimal_plugin with custom options" {
    local plugin_name="test-custom-plugin"
    local plugin_path
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"

    # Create with custom version and author
    plugin_path=$(create_minimal_plugin "$FIXTURE_ROOT" "$plugin_name" "2.5.0" "Custom Author")

    local manifest="$plugin_path/.claude-plugin/plugin.json"

    local version
    version=$(json_get "$manifest" "version")
    [ "$version" = "2.5.0" ]

    local author
    author=$(json_get "$manifest" "author")
    [[ "$author" =~ "Custom Author" ]]
}

@test "create_full_plugin includes hooks.json with valid structure" {
    local plugin_name="test-hooks-plugin"
    local plugin_path
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"

    plugin_path=$(create_full_plugin "$FIXTURE_ROOT" "$plugin_name")

    local hooks_file="$plugin_path/hooks/hooks.json"
    [ -f "$hooks_file" ]

    # Verify valid JSON
    validate_json "$hooks_file"

    # Verify required fields
    json_has_field "$hooks_file" "description"
    json_has_field "$hooks_file" "hooks"
}

@test "fixture factory generates valid plugin names only" {
    local FIXTURE_ROOT="${TEST_TEMP_DIR}/fixtures"

    # Test various valid names
    run create_minimal_plugin "$FIXTURE_ROOT" "valid-name-123"
    [ "$status" -eq 0 ]

    run create_minimal_plugin "$FIXTURE_ROOT" "test_plugin"
    [ "$status" -ne 0 ]

    run create_minimal_plugin "$FIXTURE_ROOT" "TestPlugin"
    [ "$status" -ne 0 ]

    run create_minimal_plugin "$FIXTURE_ROOT" "test.plugin"
    [ "$status" -ne 0 ]
}
