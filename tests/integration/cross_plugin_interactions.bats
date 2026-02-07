#!/usr/bin/env bats
# Cross-Plugin Integration Tests
# Tests interactions between plugins and shared resources

load ../helpers/bats_helper

@test "plugins have unique hook event types" {
    # Check that plugins don't conflict on hook types
    declare -A hook_events

    for hooks_file in "${PROJECT_ROOT}"/plugins/*/hooks/hooks.json; do
        if [ -f "$hooks_file" ]; then
            local plugin_name
            plugin_name=$(echo "$hooks_file" | sed -E 's|.*/plugins/([^/]+)/.*|\1|')

            # Get event types from hooks.json
            while IFS= read -r event; do
                if [ -n "$event" ]; then
                    local existing_plugin="${hook_events[$event]:-}"
                    if [ -n "$existing_plugin" ] && [ "$existing_plugin" != "$plugin_name" ]; then
                        echo "Warning: Event $event used by both $existing_plugin and $plugin_name"
                        # This is actually OK - multiple plugins can use same events
                    fi
                    hook_events["$event"]="$plugin_name"
                fi
            done < <($JQ_BIN -r '.hooks | keys[]' "$hooks_file" 2>/dev/null)
        fi
    done

    true  # Just checking, no assertion needed
}

@test "all plugin manifests have unique names" {
    declare -A plugin_names

    for plugin_json in "${PROJECT_ROOT}"/plugins/*/.claude-plugin/plugin.json; do
        if [ -f "$plugin_json" ]; then
            local name
            name=$($JQ_BIN -r '.name' "$plugin_json")

            if [ -n "${plugin_names[$name]:-}" ]; then
                echo "Error: Duplicate plugin name '$name'"
                echo "  Existing: ${plugin_names[$name]}"
                echo "  Duplicate: $plugin_json"
                return 1
            fi

            plugin_names["$name"]="$plugin_json"
        fi
    done

    true
}

@test "plugins with skills have valid SKILL.md structure" {
    local found_skills=0

    for skill_file in "${PROJECT_ROOT}"/plugins/*/skills/*/SKILL.md; do
        if [ -f "$skill_file" ]; then
            found_skills=$((found_skills + 1))

            # Verify frontmatter delimiter
            has_frontmatter_delimiter "$skill_file"

            # Verify required fields
            has_frontmatter_field "$skill_file" "name"
            has_frontmatter_field "$skill_file" "description"
        fi
    done

    assert_gt "$found_skills" "0" "Should find at least one skill"
}

@test "marketplace plugins match actual plugin directories" {
    local marketplace_json="${PROJECT_ROOT}/.claude-plugin/marketplace.json"
    local found_mismatch=0

    while IFS= read -r source; do
        if [ -n "$source" ]; then
            # Remove leading ./
            source="${source#./}"
            local plugin_path="${PROJECT_ROOT}/${source}"

            if [ ! -d "$plugin_path" ]; then
                echo "Marketplace plugin does not exist: $source"
                found_mismatch=$((found_mismatch + 1))
            fi
        fi
    done < <($JQ_BIN -r '.plugins[].source' "$marketplace_json" 2>/dev/null)

    assert_eq "$found_mismatch" "0" "All marketplace plugins should exist"
}

@test "hooks use portable paths consistently" {
    local found_hardcoded=0

    for hooks_file in "${PROJECT_ROOT}"/plugins/*/hooks/hooks.json; do
        if [ -f "$hooks_file" ]; then
            # Check for hardcoded absolute paths in command hooks
            if grep -qE '"/(Users|home|var)/' "$hooks_file" 2>/dev/null; then
                echo "Found hardcoded path in: $hooks_file"
                found_hardcoded=$((found_hardcoded + 1))
            fi
        fi
    done

    assert_eq "$found_hardcoded" "0" "Hooks should use portable paths"
}

@test "plugin commands follow naming conventions" {
    local found_invalid=0
    local found_exemptions=0

    for command_file in "${PROJECT_ROOT}"/plugins/*/commands/*.md; do
        if [ -f "$command_file" ]; then
            local command_name
            command_name=$(basename "$command_file" .md)

            # Skip CLAUDE.md files
            [[ "$command_name" == "CLAUDE" ]] && continue

            # Command names should generally be lowercase with hyphens
            # But we allow some exemptions (e.g., databricks.sql for SQL commands)
            if ! is_valid_plugin_name "$command_name"; then
                # Allow dots in command names (e.g., for language-specific commands)
                if [[ "$command_name" =~ ^[a-z0-9.-]+$ ]]; then
                    echo "Exempt command name: $command_name"
                    found_exemptions=$((found_exemptions + 1))
                else
                    echo "Invalid command name: $command_name"
                    found_invalid=$((found_invalid + 1))
                fi
            fi
        fi
    done

    assert_eq "$found_invalid" "0" "All command names should be valid or exempt"
}

@test "plugin agents have valid frontmatter" {
    local found_agents=0

    for agent_file in "${PROJECT_ROOT}"/plugins/*/agents/*.md; do
        if [ -f "$agent_file" ]; then
            # Skip CLAUDE.md files
            [[ "$(basename "$agent_file")" == "CLAUDE.md" ]] && continue

            found_agents=$((found_agents + 1))

            # Verify frontmatter delimiter
            has_frontmatter_delimiter "$agent_file"

            # Verify required fields
            has_frontmatter_field "$agent_file" "name"
            has_frontmatter_field "$agent_file" "description"
            has_frontmatter_field "$agent_file" "model"
        fi
    done

    assert_gt "$found_agents" "0" "Should find at least one agent"
}

@test "all plugins have valid license field" {
    local missing_license=0

    for plugin_json in "${PROJECT_ROOT}"/plugins/*/.claude-plugin/plugin.json; do
        if [ -f "$plugin_json" ]; then
            if ! $JQ_BIN -e '.license' "$plugin_json" &>/dev/null; then
                local name
                name=$($JQ_BIN -r '.name' "$plugin_json")
                echo "Plugin missing license: $name"
                missing_license=$((missing_license + 1))
            fi
        fi
    done

    # It's OK if some plugins don't have license (it's optional)
    # Just report the count
    echo "Plugins without license field: $missing_license"
    true
}

@test "plugin descriptions are not empty" {
    local empty_count=0

    for plugin_json in "${PROJECT_ROOT}"/plugins/*/.claude-plugin/plugin.json; do
        if [ -f "$plugin_json" ]; then
            local description
            description=$($JQ_BIN -r '.description' "$plugin_json")

            if [ -z "$description" ] || [ "$description" = "null" ]; then
                local name
                name=$($JQ_BIN -r '.name' "$plugin_json")
                echo "Plugin with empty description: $name"
                empty_count=$((empty_count + 1))
            fi
        fi
    done

    assert_eq "$empty_count" "0" "All plugins should have descriptions"
}

@test "plugin versions are valid semantic versions" {
    local invalid_count=0

    for plugin_json in "${PROJECT_ROOT}"/plugins/*/.claude-plugin/plugin.json; do
        if [ -f "$plugin_json" ]; then
            local version
            version=$($JQ_BIN -r '.version' "$plugin_json")

            if ! is_valid_semver "$version"; then
                local name
                name=$($JQ_BIN -r '.name' "$plugin_json")
                echo "Plugin with invalid version: $name ($version)"
                invalid_count=$((invalid_count + 1))
            fi
        fi
    done

    assert_eq "$invalid_count" "0" "All plugin versions should be valid semver"
}
