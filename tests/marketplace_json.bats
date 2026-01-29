#!/usr/bin/env bats
# Test: marketplace.json validation

load helpers/bats_helper

MARKETPLACE_JSON="${PROJECT_ROOT}/.claude-plugin/marketplace.json"

setup() {
    ensure_jq
}

@test "marketplace.json exists" {
    assert_file_exists "$MARKETPLACE_JSON" "marketplace.json should exist"
}

@test "marketplace.json is valid JSON" {
    validate_json "$MARKETPLACE_JSON"
}

@test "marketplace.json has required fields" {
    json_has_field "$MARKETPLACE_JSON" "name"
    json_has_field "$MARKETPLACE_JSON" "owner.name"
    json_has_field "$MARKETPLACE_JSON" "plugins"
}

@test "marketplace.json owner.name is not empty" {
    local owner_name
    owner_name=$(json_get "$MARKETPLACE_JSON" "owner.name")
    assert_not_empty "$owner_name" "marketplace.json owner.name field should not be empty"
}

@test "marketplace.json plugins array exists" {
    local plugins
    plugins=$($JQ_BIN -r '.plugins | type' "$MARKETPLACE_JSON")
    assert_eq "$plugins" "array" "marketplace.json plugins field should be an array"
}

@test "marketplace.json includes all plugins in plugins/ directory" {
    # Get all plugin directories
    local plugin_dirs=()
    plugin_dirs=($(find "${PROJECT_ROOT}/plugins" -mindepth 1 -maxdepth 1 -type d -exec basename {} \;))

    # Get all plugins listed in marketplace.json (extract just the plugin name)
    local marketplace_plugins=()
    marketplace_plugins=($($JQ_BIN -r '.plugins[].source' "$MARKETPLACE_JSON" | sed 's|^\./plugins/||'))

    # Track missing plugins
    local missing_plugins=()

    # Check each plugin directory is listed
    for plugin in "${plugin_dirs[@]}"; do
        # Skip if directory doesn't have plugin.json
        [ -f "${PROJECT_ROOT}/plugins/${plugin}/.claude-plugin/plugin.json" ] || continue

        # Check if plugin is in marketplace.json
        local found=0
        for mp_plugin in "${marketplace_plugins[@]}"; do
            if [ "$mp_plugin" == "$plugin" ]; then
                found=1
                break
            fi
        done

        if [ $found -eq 0 ]; then
            missing_plugins+=("$plugin")
        fi
    done

    # Fail if any plugins are missing
    if [ ${#missing_plugins[@]} -gt 0 ]; then
        echo "Plugins missing from marketplace.json: ${missing_plugins[*]}"
        return 1
    fi
}

@test "marketplace.json plugin sources point to existing directories" {
    # Get all plugin sources from marketplace.json
    local sources=()
    sources=($($JQ_BIN -r '.plugins[].source' "$MARKETPLACE_JSON"))

    for source in "${sources[@]}"; do
        # Remove leading ./
        local full_path="${PROJECT_ROOT}/${source}"

        # Check if directory exists
        assert_dir_exists "$full_path" "Plugin source '$source' should exist"

        # Check if plugin.json exists
        assert_file_exists "${full_path}/.claude-plugin/plugin.json" "Plugin source '$source' should have plugin.json"
    done
}
