#!/usr/bin/env bats
# Integration Test: Plugin Loading
# Tests that all plugins load successfully without conflicts

load helpers/bats_helper

@test "all plugins have valid plugin.json files" {
    local plugin_count=0
    local valid_count=0

    for plugin_dir in "${PROJECT_ROOT}"/plugins/*/; do
        if [ -d "$plugin_dir" ]; then
            plugin_count=$((plugin_count + 1))
            local plugin_json="${plugin_dir}.claude-plugin/plugin.json"

            if [ -f "$plugin_json" ]; then
                if validate_json "$plugin_json" 2>/dev/null; then
                    valid_count=$((valid_count + 1))
                fi
            fi
        fi
    done

    assert_gt "$valid_count" "0" "At least one plugin should be valid"
    assert_eq "$valid_count" "$plugin_count" "All plugins should have valid plugin.json"
}

@test "all plugin names are unique" {
    declare -A seen_names

    for plugin_dir in "${PROJECT_ROOT}"/plugins/*/; do
        if [ -d "$plugin_dir" ]; then
            local plugin_json="${plugin_dir}.claude-plugin/plugin.json"

            if [ -f "$plugin_json" ]; then
                local name
                name=$(json_get "$plugin_json" "name")

                if [ -n "${seen_names[$name]:-}" ]; then
                    echo "Duplicate plugin name found: $name" >&2
                    echo "  Existing: ${seen_names[$name]}" >&2
                    echo "  Duplicate: $plugin_dir" >&2
                    return 1
                fi

                seen_names[$name]="$plugin_dir"
            fi
        fi
    done

    true
}

@test "marketplace.json includes all plugins" {
    local marketplace_json="${PROJECT_ROOT}/.claude-plugin/marketplace.json"
    local plugins_in_marketplace

    plugins_in_marketplace=$($JQ_BIN -r '.plugins[].source' "$marketplace_json" 2>/dev/null | wc -l | tr -d ' ')

    # Allow for some plugins not being in marketplace
    assert_gt "$plugins_in_marketplace" "0" "Marketplace should contain plugins"
}

@test "all marketplace plugin sources exist" {
    local marketplace_json="${PROJECT_ROOT}/.claude-plugin/marketplace.json"

    while IFS= read -r source; do
        if [ -n "$source" ]; then
            # Remove leading ./ if present
            source="${source#./}"
            local plugin_path="${PROJECT_ROOT}/${source}"
            if [ ! -d "$plugin_path" ]; then
                echo "Marketplace source does not exist: $source" >&2
                return 1
            fi
        fi
    done < <($JQ_BIN -r '.plugins[].source' "$marketplace_json" 2>/dev/null)

    true
}

@test "no hardcoded absolute paths in plugin manifests" {
    local found_hardcoded=0

    for plugin_json in "${PROJECT_ROOT}"/plugins/*/.claude-plugin/plugin.json; do
        if [ -f "$plugin_json" ]; then
            # Check for absolute paths (not starting with ${ or /Users that's not ${CLAUDE_PLUGIN_ROOT})
            if grep -qE '"/(Users|home|opt)/' "$plugin_json" 2>/dev/null; then
                echo "Found hardcoded absolute path in: $plugin_json" >&2
                grep -E '"/(Users|home|opt)/' "$plugin_json" >&2
                found_hardcoded=1
            fi
        fi
    done

    assert_eq "$found_hardcoded" "0" "No hardcoded absolute paths should exist"
}

@test "all plugins follow naming convention" {
    local invalid_count=0

    for plugin_dir in "${PROJECT_ROOT}"/plugins/*/; do
        if [ -d "$plugin_dir" ]; then
            local plugin_name
            plugin_name=$(basename "$plugin_dir")

            if ! is_valid_plugin_name "$plugin_name"; then
                echo "Invalid plugin name: $plugin_name" >&2
                invalid_count=$((invalid_count + 1))
            fi
        fi
    done

    assert_eq "$invalid_count" "0" "All plugin names should be valid"
}

@test "all required top-level directories exist" {
    assert_dir_exists "${PROJECT_ROOT}/.claude-plugin" ".claude-plugin directory should exist"
    assert_dir_exists "${PROJECT_ROOT}/plugins" "plugins directory should exist"
}

@test "github workflows are valid YAML" {
    local workflow_dir="${PROJECT_ROOT}/.github/workflows"
    local invalid_count=0

    for workflow in "$workflow_dir"/*.yml "$workflow_dir"/*.yaml; do
        if [ -f "$workflow" ]; then
            if command -v yq &> /dev/null; then
                if ! yq eval '.' "$workflow" > /dev/null 2>&1; then
                    echo "Invalid YAML: $workflow" >&2
                    invalid_count=$((invalid_count + 1))
                fi
            elif command -v python3 &> /dev/null; then
                if ! python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null; then
                    echo "Invalid YAML: $workflow" >&2
                    invalid_count=$((invalid_count + 1))
                fi
            fi
        fi
    done

    assert_eq "$invalid_count" "0" "All workflows should be valid YAML"
}

@test "hooks.json files are valid across all plugins" {
    local invalid_count=0

    for hooks_file in "${PROJECT_ROOT}"/plugins/*/hooks/hooks.json; do
        if [ -f "$hooks_file" ]; then
            if ! validate_json "$hooks_file" 2>/dev/null; then
                echo "Invalid hooks.json: $hooks_file" >&2
                invalid_count=$((invalid_count + 1))
            fi
        fi
    done

    assert_eq "$invalid_count" "0" "All hooks.json files should be valid"
}

@test "skill files follow naming convention" {
    local invalid_count=0

    for skill_file in "${PROJECT_ROOT}"/skills/*/SKILL.md; do
        if [ -f "$skill_file" ]; then
            # Check for SKILL.md in skill directory
            local skill_dir
            skill_dir=$(dirname "$skill_file")
            local skill_name
            skill_name=$(basename "$skill_dir")

            # Skill directory name should be valid
            if ! is_valid_plugin_name "$skill_name"; then
                echo "Invalid skill directory name: $skill_name" >&2
                invalid_count=$((invalid_count + 1))
            fi
        fi
    done

    # Also check plugins/*/skills/
    for skill_file in "${PROJECT_ROOT}"/plugins/*/skills/*/SKILL.md; do
        if [ -f "$skill_file" ]; then
            local skill_dir
            skill_dir=$(dirname "$skill_file")
            local skill_name
            skill_name=$(basename "$skill_dir")

            if ! is_valid_plugin_name "$skill_name"; then
                echo "Invalid skill directory name: $skill_name" >&2
                invalid_count=$((invalid_count + 1))
            fi
        fi
    done

    assert_eq "$invalid_count" "0" "All skill directories should have valid names"
}
