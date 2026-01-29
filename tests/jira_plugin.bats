#!/usr/bin/env bats

# Tests for jira plugin structure and validity

load helpers/bats_helper

setup() {
    ensure_jq
}

@test "jira plugin directory exists" {
  assert_dir_exists "plugins/jira" "jira plugin directory should exist"
}

@test "jira .claude-plugin directory exists" {
  assert_dir_exists "plugins/jira/.claude-plugin" "jira .claude-plugin directory should exist"
}

@test "jira plugin.json exists" {
  assert_file_exists "plugins/jira/.claude-plugin/plugin.json" "jira plugin.json should exist"
}

@test "jira .mcp.json exists" {
  assert_file_exists "plugins/jira/.mcp.json" "jira .mcp.json should exist"
}

@test "jira README.md exists" {
  assert_file_exists "plugins/jira/README.md" "jira README.md should exist"
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
  local name
  name=$(json_get plugins/jira/.claude-plugin/plugin.json "name")
  assert_eq "$name" "jira" "plugin.json name field should be 'jira'"
}

@test "jira plugin.json has required version field" {
  local version
  version=$(json_get plugins/jira/.claude-plugin/plugin.json "version")
  assert_not_empty "$version" "plugin.json version field should not be empty"
  is_valid_semver "$version"
}

@test "jira plugin.json has required description field" {
  local description
  description=$(json_get plugins/jira/.claude-plugin/plugin.json "description")
  assert_not_empty "$description" "plugin.json description field should not be empty"
}

@test "jira plugin.json has required author field" {
  local author
  author=$($JQ_BIN -r '.author.name' plugins/jira/.claude-plugin/plugin.json)
  assert_not_empty "$author" "plugin.json author.name field should not be empty"
}

@test "jira plugin registered in marketplace.json" {
  $JQ_BIN -e '.plugins[] | select(.name == "jira")' .claude-plugin/marketplace.json
}

@test "jira marketplace entry has matching version" {
  local plugin_version marketplace_version
  plugin_version=$($JQ_BIN -r '.version' plugins/jira/.claude-plugin/plugin.json)
  marketplace_version=$($JQ_BIN -r '.plugins[] | select(.name == "jira") | .version' .claude-plugin/marketplace.json)
  assert_eq "$plugin_version" "$marketplace_version" "marketplace.json version should match plugin.json version"
}

@test "jira marketplace entry has correct source path" {
  local source
  source=$($JQ_BIN -r '.plugins[] | select(.name == "jira") | .source' .claude-plugin/marketplace.json)
  assert_eq "$source" "./plugins/jira" "marketplace.json source path should be './plugins/jira'"
}

@test "jira marketplace entry has category" {
  local category
  category=$($JQ_BIN -r '.plugins[] | select(.name == "jira") | .category' .claude-plugin/marketplace.json)
  assert_not_empty "$category" "marketplace.json category field should not be empty"
}

@test "jira marketplace entry has tags" {
  local tags
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
  local command
  command=$($JQ_BIN -r '.mcpServers.atlassian.command' plugins/jira/.mcp.json)
  assert_eq "$command" "npx" "atlassian command should be 'npx'"
}

@test "jira .mcp.json atlassian config has args array" {
  local args
  args=$($JQ_BIN -r '.mcpServers.atlassian.args | length' plugins/jira/.mcp.json)
  [ "$args" -gt 0 ]
}

@test "jira .mcp.json uses mcp-remote proxy" {
  local args
  args=$($JQ_BIN -r '.mcpServers.atlassian.args | join(" ")' plugins/jira/.mcp.json)
  assert_matches "$args" "mcp-remote" "atlassian args should contain 'mcp-remote'"
}
