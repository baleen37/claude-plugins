#!/usr/bin/env bats

load "${BATS_TEST_DIRNAME}/helpers/bats-support/load.bash"
load "${BATS_TEST_DIRNAME}/helpers/bats-assert/load.bash"

@test "plugin.json has required fields" {
    run jq -r '.name' "plugins/example-plugin/.claude-plugin/plugin.json"
    assert_output --regexp '^[a-z0-9-]+$'

    run jq -r '.description' "plugins/example-plugin/.claude-plugin/plugin.json"
    assert [ -n "$output" ]

    run jq -r '.version' "plugins/example-plugin/.claude-plugin/plugin.json"
    assert_output --regexp '^[0-9]+\.[0-9]+\.[0-9]+$'

    run jq -r '.author' "plugins/example-plugin/.claude-plugin/plugin.json"
    assert [ -n "$output" ]
}

@test "marketplace.json has required fields" {
    run jq -r '.name' ".claude-plugin/marketplace.json"
    assert_output --regexp '^[a-z0-9-]+$'

    run jq -r '.owner.name' ".claude-plugin/marketplace.json"
    assert [ -n "$output" ]

    run jq -r '.plugins | length' ".claude-plugin/marketplace.json"
    assert_output --regexp '^[1-9]'
}
