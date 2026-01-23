#!/usr/bin/env bats
# Test: hooks.json validation

load helpers/bats_helper

setup() {
    ensure_jq
}

@test "hooks.json is valid JSON" {
    for hooks_file in "${PROJECT_ROOT}"/plugins/*/hooks/hooks.json; do
        if [ -f "$hooks_file" ]; then
            validate_json "$hooks_file"
        fi
    done
}

@test "hooks.json has required top-level structure" {
    for hooks_file in "${PROJECT_ROOT}"/plugins/*/hooks/hooks.json; do
        if [ -f "$hooks_file" ]; then
            # hooks field must exist and be an object
            json_has_field "$hooks_file" "hooks"

            local hooks_type
            hooks_type=$($JQ_BIN -r '.hooks | type' "$hooks_file")
            [ "$hooks_type" = "object" ]
        fi
    done
}

@test "hooks.json events have valid structure" {
    for hooks_file in "${PROJECT_ROOT}"/plugins/*/hooks/hooks.json; do
        if [ -f "$hooks_file" ]; then
            local events
            events=$($JQ_BIN -r '.hooks | keys[]' "$hooks_file")

            while IFS= read -r event; do
                # Each event must be an array
                local event_type
                event_type=$($JQ_BIN -r ".hooks[\"$event\"] | type" "$hooks_file")
                [ "$event_type" = "array" ]

                # Each event entry must have matcher and hooks fields
                local entries
                entries=$($JQ_BIN -r ".hooks[\"$event\"] | length" "$hooks_file")
                for ((i=0; i<entries; i++)); do
                    local has_matcher
                    has_matcher=$($JQ_BIN -e ".hooks[\"$event\"][$i].matcher" "$hooks_file")
                    [ -n "$has_matcher" ]

                    local has_hooks
                    has_hooks=$($JQ_BIN -e ".hooks[\"$event\"][$i].hooks" "$hooks_file")
                    [ -n "$has_hooks" ]

                    # hooks must be an array
                    local hooks_arr_type
                    hooks_arr_type=$($JQ_BIN -r ".hooks[\"$event\"][$i].hooks | type" "$hooks_file")
                    [ "$hooks_arr_type" = "array" ]
                done
            done <<< "$events"
        fi
    done
}

@test "hooks.json hook entries have required type field" {
    for hooks_file in "${PROJECT_ROOT}"/plugins/*/hooks/hooks.json; do
        if [ -f "$hooks_file" ]; then
            local events
            events=$($JQ_BIN -r '.hooks | keys[]' "$hooks_file")

            while IFS= read -r event; do
                local entries
                entries=$($JQ_BIN -r ".hooks[\"$event\"] | length" "$hooks_file")
                for ((i=0; i<entries; i++)); do
                    local hook_entries
                    hook_entries=$($JQ_BIN -r ".hooks[\"$event\"][$i].hooks | length" "$hooks_file")
                    for ((j=0; j<hook_entries; j++)); do
                        local hook_type
                        hook_type=$($JQ_BIN -r ".hooks[\"$event\"][$i].hooks[$j].type" "$hooks_file")
                        [ "$hook_type" = "command" ] || [ "$hook_type" = "prompt" ] || [ "$hook_type" = "agent" ]
                    done
                done
            done <<< "$events"
        fi
    done
}

@test "hooks.json command type has command field" {
    for hooks_file in "${PROJECT_ROOT}"/plugins/*/hooks/hooks.json; do
        if [ -f "$hooks_file" ]; then
            local events
            events=$($JQ_BIN -r '.hooks | keys[]' "$hooks_file")

            while IFS= read -r event; do
                local entries
                entries=$($JQ_BIN -r ".hooks[\"$event\"] | length" "$hooks_file")
                for ((i=0; i<entries; i++)); do
                    local hook_entries
                    hook_entries=$($JQ_BIN -r ".hooks[\"$event\"][$i].hooks | length" "$hooks_file")
                    for ((j=0; j<hook_entries; j++)); do
                        local hook_type
                        hook_type=$($JQ_BIN -r ".hooks[\"$event\"][$i].hooks[$j].type" "$hooks_file")

                        if [ "$hook_type" = "command" ]; then
                            local command
                            command=$($JQ_BIN -e ".hooks[\"$event\"][$i].hooks[$j].command" "$hooks_file")
                            [ -n "$command" ]
                        fi
                    done
                done
            done <<< "$events"
        fi
    done
}

@test "hooks.json uses portable CLAUDE_PLUGIN_ROOT paths" {
    for hooks_file in "${PROJECT_ROOT}"/plugins/*/hooks/hooks.json; do
        if [ -f "$hooks_file" ]; then
            # Check for hardcoded absolute paths in command fields
            local has_hardcoded_path
            has_hardcoded_path=$($JQ_BIN -r '.. | .command? // empty' "$hooks_file" | grep -E '^/' || true)

            if [ -n "$has_hardcoded_path" ]; then
                echo "Error: Found hardcoded absolute path in $hooks_file"
                echo "Use \${CLAUDE_PLUGIN_ROOT} instead"
                return 1
            fi
        fi
    done
}
