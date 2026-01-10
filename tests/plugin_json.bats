#!/usr/bin/env bats
# Test: plugin.json validation

load bats_helper

PLUGIN_JSON="${PROJECT_ROOT}/plugins/example-plugin/.claude-plugin/plugin.json"

setup() {
    ensure_jq
}

@test "plugin.json exists" {
    [ -f "$PLUGIN_JSON" ]
}

@test "plugin.json is valid JSON" {
    validate_json "$PLUGIN_JSON"
}

@test "plugin.json has required fields" {
    json_has_field "$PLUGIN_JSON" "name"
    json_has_field "$PLUGIN_JSON" "description"
    json_has_field "$PLUGIN_JSON" "author"
}

@test "plugin.json name follows naming convention" {
    name=$(json_get "$PLUGIN_JSON" "name")
    is_valid_plugin_name "$name"
}

@test "plugin.json fields are not empty" {
    name=$(json_get "$PLUGIN_JSON" "name")
    description=$(json_get "$PLUGIN_JSON" "description")
    author=$(json_get "$PLUGIN_JSON" "author")

    [ -n "$name" ]
    [ -n "$description" ]
    [ -n "$author" ]
}

@test "plugin.json uses only allowed fields" {
    validate_plugin_manifest_fields "$PLUGIN_JSON"
}

# Test all plugin manifests in the repository
@test "all plugin.json files use only allowed fields" {
    local failed=0

    for manifest in "${PROJECT_ROOT}"/plugins/*/.claude-plugin/plugin.json; do
        if [ -f "$manifest" ]; then
            if ! validate_plugin_manifest_fields "$manifest"; then
                ((failed++))
            fi
        fi
    done

    [ "$failed" -eq 0 ]
}
