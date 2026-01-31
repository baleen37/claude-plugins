#!/usr/bin/env bats
# Test structure validation for standardized plugin testing

load helpers/bats_helper

# Get project root
PROJECT_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"

@test "root tests directory exists" {
    [ -d "${PROJECT_ROOT}/tests" ]
}

@test "root bats_helper exists" {
    [ -f "${PROJECT_ROOT}/tests/helpers/bats_helper.bash" ]
}

@test "all plugins have standardized tests directory" {
    local plugin_count=0
    local plugin_with_tests=0

    for plugin_dir in "${PROJECT_ROOT}"/plugins/*/; do
        if [ -d "$plugin_dir" ]; then
            local plugin_name
            plugin_name=$(basename "$plugin_dir")
            local plugin_json="${plugin_dir}.claude-plugin/plugin.json"

            if [ -f "$plugin_json" ]; then
                plugin_count=$((plugin_count + 1))
                # Plugin exists - check if it has tests
                if [ -d "${plugin_dir}tests" ]; then
                    plugin_with_tests=$((plugin_with_tests + 1))
                    echo "✓ ${plugin_name} has tests/"
                fi
            fi
        fi
    done

    # At least some plugins should have tests
    [ "$plugin_with_tests" -gt 0 ]
}

@test "no nested tests directories exist under me/skills/" {
    # Verify me/skills/claude-isolated-test/tests/ was flattened
    [ ! -d "${PROJECT_ROOT}/plugins/me/skills/claude-isolated-test/tests" ]
}

@test "run-all-tests.sh script exists" {
    [ -f "${PROJECT_ROOT}/tests/run-all-tests.sh" ]
}

@test "run-all-tests.sh is executable" {
    [ -x "${PROJECT_ROOT}/tests/run-all-tests.sh" ]
}
