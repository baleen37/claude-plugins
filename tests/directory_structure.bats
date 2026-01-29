#!/usr/bin/env bats
# Test: Required directory structure

load helpers/bats_helper

@test "Required directories exist" {
    assert_dir_exists "${PROJECT_ROOT}/.claude-plugin" "root .claude-plugin directory should exist"
    assert_dir_exists "${PROJECT_ROOT}/plugins" "plugins directory should exist"

    # Check each plugin has required .claude-plugin directory
    for plugin_dir in "${PROJECT_ROOT}/plugins"/*; do
        if [ -d "$plugin_dir" ]; then
            local plugin_name
            plugin_name=$(basename "$plugin_dir")
            assert_dir_exists "${plugin_dir}/.claude-plugin" "plugin ${plugin_name} should have .claude-plugin directory"
        fi
    done
}

@test "Each plugin has valid plugin.json" {
    for plugin_dir in "${PROJECT_ROOT}/plugins"/*; do
        if [ -d "$plugin_dir" ]; then
            local plugin_name plugin_json
            plugin_name=$(basename "$plugin_dir")
            plugin_json="${plugin_dir}/.claude-plugin/plugin.json"
            assert_file_exists "$plugin_json" "plugin ${plugin_name} should have plugin.json"
            [ -s "$plugin_json" ]
        fi
    done
}

@test "Plugin directories follow naming convention" {
    # Plugin directories should be lowercase with hyphens
    for plugin_dir in "${PROJECT_ROOT}/plugins"/*; do
        if [ -d "$plugin_dir" ]; then
            local plugin_name
            plugin_name=$(basename "$plugin_dir")
            is_valid_plugin_name "$plugin_name"
        fi
    done
}
