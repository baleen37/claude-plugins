#!/usr/bin/env bats

# Tests for jira plugin structure and validity

load helpers/bats_helper

setup() {
    ensure_jq
}

@test "jira plugin directory exists" {
  [ -d "plugins/jira" ]
}

@test "jira .claude-plugin directory exists" {
  [ -d "plugins/jira/.claude-plugin" ]
}

@test "jira plugin.json exists" {
  [ -f "plugins/jira/.claude-plugin/plugin.json" ]
}

@test "jira .mcp.json exists" {
  [ -f "plugins/jira/.mcp.json" ]
}

@test "jira README.md exists" {
  [ -f "plugins/jira/README.md" ]
}

@test "jira plugin.json is valid JSON" {
  run validate_json plugins/jira/.claude-plugin/plugin.json
  [ "$status" -eq 0 ]
}

@test "jira .mcp.json is valid JSON" {
  run validate_json plugins/jira/.mcp.json
  [ "$status" -eq 0 ]
}

@test "jira plugin.json has required name field" {
  name=$(json_get plugins/jira/.claude-plugin/plugin.json "name")
  [ "$name" = "jira" ]
}

@test "jira plugin.json has required version field" {
  version=$(json_get plugins/jira/.claude-plugin/plugin.json "version")
  [ -n "$version" ]
  is_valid_semver "$version"
}

@test "jira plugin.json has required description field" {
  description=$(json_get plugins/jira/.claude-plugin/plugin.json "description")
  [ -n "$description" ]
}

@test "jira plugin.json has required author field" {
  author=$($JQ_BIN -r '.author.name' plugins/jira/.claude-plugin/plugin.json)
  [ -n "$author" ]
}

@test "jira plugin registered in marketplace.json" {
  $JQ_BIN -e '.plugins[] | select(.name == "jira")' .claude-plugin/marketplace.json
}

@test "jira marketplace entry has matching version" {
  plugin_version=$($JQ_BIN -r '.version' plugins/jira/.claude-plugin/plugin.json)
  marketplace_version=$($JQ_BIN -r '.plugins[] | select(.name == "jira") | .version' .claude-plugin/marketplace.json)
  [ "$plugin_version" = "$marketplace_version" ]
}

@test "jira marketplace entry has correct source path" {
  source=$($JQ_BIN -r '.plugins[] | select(.name == "jira") | .source' .claude-plugin/marketplace.json)
  [ "$source" = "./plugins/jira" ]
}

@test "jira marketplace entry has category" {
  category=$($JQ_BIN -r '.plugins[] | select(.name == "jira") | .category' .claude-plugin/marketplace.json)
  [ -n "$category" ]
}

@test "jira marketplace entry has tags" {
  tags=$($JQ_BIN -r '.plugins[] | select(.name == "jira") | .tags | length' .claude-plugin/marketplace.json)
  [ "$tags" -gt 0 ]
}

@test "jira .mcp.json has mcpServers wrapper" {
  $JQ_BIN -e '.mcpServers' plugins/jira/.mcp.json
}

@test "jira .mcp.json has atlassian server configuration" {
  $JQ_BIN -e '.mcpServers.atlassian' plugins/jira/.mcp.json
}

@test "jira .mcp.json atlassian config has command field" {
  command=$($JQ_BIN -r '.mcpServers.atlassian.command' plugins/jira/.mcp.json)
  [ "$command" = "npx" ]
}

@test "jira .mcp.json atlassian config has args array" {
  args=$($JQ_BIN -r '.mcpServers.atlassian.args | length' plugins/jira/.mcp.json)
  [ "$args" -gt 0 ]
}

@test "jira .mcp.json uses mcp-remote proxy" {
  args=$($JQ_BIN -r '.mcpServers.atlassian.args | join(" ")' plugins/jira/.mcp.json)
  [[ "$args" =~ mcp-remote ]]
}
