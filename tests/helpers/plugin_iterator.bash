#!/usr/bin/env bash
# Plugin Iterator Helper
# Provides simplified functions for iterating over plugin directories
#
# This helper provides simple, consistent patterns for iterating over plugins
# in the codebase. It wraps the more complex functions in test_utils.bash.
#
# Usage:
#   load helpers/plugin_iterator  # in your BATS test file

# Execute a callback function for each plugin directory
# Args:
#   $1 - Callback function name (receives plugin dir path as first arg)
# Usage:
#   check_plugin() {
#     local plugin_dir="$1"
#     echo "Checking: $plugin_dir"
#   }
#   for_each_plugin_dir check_plugin
for_each_plugin_dir() {
    local callback="$1"
    local plugin_dir

    for plugin_dir in "${PROJECT_ROOT}"/plugins/*/; do
        if [ -d "$plugin_dir" ]; then
            "$callback" "$plugin_dir"
        fi
    done
}

# Count the number of plugin directories in the project
# Returns: Count of plugin directories (outputs to stdout)
# Usage: local count; count=$(count_plugins)
count_plugins() {
    local count=0
    local plugin_dir

    for plugin_dir in "${PROJECT_ROOT}"/plugins/*/; do
        if [ -d "$plugin_dir" ]; then
            count=$((count + 1))
        fi
    done

    echo "$count"
}

# Find plugins that are invalid (missing plugin.json)
# Returns: Newline-separated list of invalid plugin directory paths
# Usage:
#   local invalid
#   invalid=$(find_invalid_plugins)
#   if [ -n "$invalid" ]; then
#     echo "Invalid plugins found"
#   fi
find_invalid_plugins() {
    local invalid_plugins=""
    local plugin_dir

    for plugin_dir in "${PROJECT_ROOT}"/plugins/*/; do
        if [ -d "$plugin_dir" ]; then
            local plugin_json="${plugin_dir}.claude-plugin/plugin.json"
            if [ ! -f "$plugin_json" ]; then
                if [ -n "$invalid_plugins" ]; then
                    invalid_plugins="${invalid_plugins}"$'\n'"${plugin_dir}"
                else
                    invalid_plugins="${plugin_dir}"
                fi
            fi
        fi
    done

    echo "$invalid_plugins"
}
