#!/usr/bin/env bats
# Test: plugin.json validation

load helpers/bats_helper

setup() {
    ensure_jq
}

@test "plugin.json exists" {
    local found=0

    for manifest in "${PROJECT_ROOT}"/plugins/*/.claude-plugin/plugin.json; do
        if [ -f "$manifest" ]; then
            found=$((found + 1))
        fi
    done

    [ "$found" -gt 0 ]
}

@test "plugin.json is valid JSON" {
    for manifest in "${PROJECT_ROOT}"/plugins/*/.claude-plugin/plugin.json; do
        if [ -f "$manifest" ]; then
            validate_json "$manifest"
        fi
    done
}

@test "plugin.json has required fields" {
    for manifest in "${PROJECT_ROOT}"/plugins/*/.claude-plugin/plugin.json; do
        if [ -f "$manifest" ]; then
            json_has_field "$manifest" "name"
            json_has_field "$manifest" "description"
            json_has_field "$manifest" "author"
        fi
    done
}

@test "plugin.json name follows naming convention" {
    for manifest in "${PROJECT_ROOT}"/plugins/*/.claude-plugin/plugin.json; do
        if [ -f "$manifest" ]; then
            local name
            name=$(json_get "$manifest" "name")
            is_valid_plugin_name "$name"
        fi
    done
}

@test "plugin.json fields are not empty" {
    for manifest in "${PROJECT_ROOT}"/plugins/*/.claude-plugin/plugin.json; do
        if [ -f "$manifest" ]; then
            local name description author
            name=$(json_get "$manifest" "name")
            description=$(json_get "$manifest" "description")
            author=$(json_get "$manifest" "author")

            assert_not_empty "$name" "plugin.json name field should not be empty in $manifest"
            assert_not_empty "$description" "plugin.json description field should not be empty in $manifest"
            assert_not_empty "$author" "plugin.json author field should not be empty in $manifest"
        fi
    done
}

@test "plugin.json uses only allowed fields" {
    for manifest in "${PROJECT_ROOT}"/plugins/*/.claude-plugin/plugin.json; do
        if [ -f "$manifest" ]; then
            validate_plugin_manifest_fields "$manifest"
        fi
    done
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
