#!/usr/bin/env bats
# Test: Required directory structure

load helpers/bats_helper

@test "Required directories exist" {
    [ -d "${PROJECT_ROOT}/.claude-plugin" ]
    [ -d "${PROJECT_ROOT}/plugins" ]

    # Check each plugin has required .claude-plugin directory
    for plugin_dir in "${PROJECT_ROOT}/plugins"/*; do
        if [ -d "$plugin_dir" ]; then
            local plugin_name
            plugin_name=$(basename "$plugin_dir")
            [ -d "${plugin_dir}/.claude-plugin" ]
        fi
    done
}

@test "Each plugin has valid plugin.json" {
    for plugin_dir in "${PROJECT_ROOT}/plugins"/*; do
        if [ -d "$plugin_dir" ]; then
            local plugin_json
            plugin_json="${plugin_dir}/.claude-plugin/plugin.json"
            [ -f "$plugin_json" ]
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
