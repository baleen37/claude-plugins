#!/usr/bin/env bats

@test "Required directories exist" {
    [ -d ".claude-plugin" ]
    [ -d "plugins" ]
    [ -d "plugins/example-plugin" ]
    [ -d "plugins/example-plugin/.claude-plugin" ]
}

@test "plugin.json exists and is valid JSON" {
    [ -f "plugins/example-plugin/.claude-plugin/plugin.json" ]
    jq empty "plugins/example-plugin/.claude-plugin/plugin.json"
}

@test "marketplace.json exists and is valid JSON" {
    [ -f ".claude-plugin/marketplace.json" ]
    jq empty ".claude-plugin/marketplace.json"
}

@test "Example plugin has required component directories" {
    [ -d "plugins/example-plugin/commands" ]
    [ -d "plugins/example-plugin/agents" ]
    [ -d "plugins/example-plugin/skills" ]
    [ -d "plugins/example-plugin/hooks" ]
}
