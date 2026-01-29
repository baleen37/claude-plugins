#!/usr/bin/env bats

# Tests for databricks plugin structure and validity

load helpers/bats_helper

setup() {
    ensure_jq
}

@test "databricks plugin directory exists" {
  assert_dir_exists "plugins/databricks" "databricks plugin directory should exist"
}

@test "databricks .claude-plugin directory exists" {
  assert_dir_exists "plugins/databricks/.claude-plugin" "databricks .claude-plugin directory should exist"
}

@test "databricks plugin.json exists" {
  assert_file_exists "plugins/databricks/.claude-plugin/plugin.json" "databricks plugin.json should exist"
}

@test "databricks .mcp.json exists" {
  assert_file_exists "plugins/databricks/.mcp.json" "databricks .mcp.json should exist"
}

@test "databricks README.md exists" {
  assert_file_exists "plugins/databricks/README.md" "databricks README.md should exist"
}

@test "databricks plugin.json is valid JSON" {
  run validate_json plugins/databricks/.claude-plugin/plugin.json
  [ "$status" -eq 0 ]
}

@test "databricks .mcp.json is valid JSON" {
  run validate_json plugins/databricks/.mcp.json
  [ "$status" -eq 0 ]
}

@test "databricks plugin.json has required name field" {
  local name
  name=$(json_get plugins/databricks/.claude-plugin/plugin.json "name")
  assert_eq "$name" "databricks" "plugin.json name field should be 'databricks'"
}

@test "databricks plugin.json has required version field" {
  local version
  version=$(json_get plugins/databricks/.claude-plugin/plugin.json "version")
  assert_not_empty "$version" "plugin.json version field should not be empty"
  is_valid_semver "$version"
}

@test "databricks plugin.json has required description field" {
  local description
  description=$(json_get plugins/databricks/.claude-plugin/plugin.json "description")
  assert_not_empty "$description" "plugin.json description field should not be empty"
}

@test "databricks plugin.json has required author field" {
  local author
  author=$($JQ_BIN -r '.author.name' plugins/databricks/.claude-plugin/plugin.json)
  assert_not_empty "$author" "plugin.json author.name field should not be empty"
}

@test "databricks plugin registered in marketplace.json" {
  $JQ_BIN -e '.plugins[] | select(.name == "databricks")' .claude-plugin/marketplace.json
}

@test "databricks marketplace entry has matching version" {
  local plugin_version marketplace_version
  plugin_version=$($JQ_BIN -r '.version' plugins/databricks/.claude-plugin/plugin.json)
  marketplace_version=$($JQ_BIN -r '.plugins[] | select(.name == "databricks") | .version' .claude-plugin/marketplace.json)
  assert_eq "$plugin_version" "$marketplace_version" "marketplace.json version should match plugin.json version"
}

@test "databricks marketplace entry has correct source path" {
  local source
  source=$($JQ_BIN -r '.plugins[] | select(.name == "databricks") | .source' .claude-plugin/marketplace.json)
  assert_eq "$source" "./plugins/databricks" "marketplace.json source path should be './plugins/databricks'"
}

@test "databricks marketplace entry has category" {
  local category
  category=$($JQ_BIN -r '.plugins[] | select(.name == "databricks") | .category' .claude-plugin/marketplace.json)
  assert_not_empty "$category" "marketplace.json category field should not be empty"
}

@test "databricks marketplace entry has tags" {
  local tags
  tags=$($JQ_BIN -r '.plugins[] | select(.name == "databricks") | .tags | length' .claude-plugin/marketplace.json)
  [ "$tags" -gt 0 ]
}

@test "databricks .mcp.json has mcpServers wrapper" {
  $JQ_BIN -e '.mcpServers' plugins/databricks/.mcp.json
}

@test "databricks .mcp.json has databricks-sql server configuration" {
  $JQ_BIN -e '.mcpServers."databricks-sql"' plugins/databricks/.mcp.json
}

@test "databricks .mcp.json has databricks-vector server configuration" {
  $JQ_BIN -e '.mcpServers."databricks-vector"' plugins/databricks/.mcp.json
}

@test "databricks .mcp.json has databricks-uc server configuration" {
  $JQ_BIN -e '.mcpServers."databricks-uc"' plugins/databricks/.mcp.json
}

@test "databricks .mcp.json databricks-sql config has command field" {
  local command
  command=$($JQ_BIN -r '.mcpServers."databricks-sql".command' plugins/databricks/.mcp.json)
  assert_eq "$command" "npx" "databricks-sql command should be 'npx'"
}

@test "databricks .mcp.json databricks-sql config has args array" {
  local args
  args=$($JQ_BIN -r '.mcpServers."databricks-sql".args | length' plugins/databricks/.mcp.json)
  [ "$args" -gt 0 ]
}

@test "databricks .mcp.json databricks-sql uses mcp-remote proxy" {
  local args
  args=$($JQ_BIN -r '.mcpServers."databricks-sql".args | join(" ")' plugins/databricks/.mcp.json)
  assert_matches "$args" "mcp-remote" "databricks-sql args should contain 'mcp-remote'"
}

@test "databricks .mcp.json databricks-vector config has command field" {
  local command
  command=$($JQ_BIN -r '.mcpServers."databricks-vector".command' plugins/databricks/.mcp.json)
  assert_eq "$command" "npx" "databricks-vector command should be 'npx'"
}

@test "databricks .mcp.json databricks-vector config has args array" {
  local args
  args=$($JQ_BIN -r '.mcpServers."databricks-vector".args | length' plugins/databricks/.mcp.json)
  [ "$args" -gt 0 ]
}

@test "databricks .mcp.json databricks-vector uses mcp-remote proxy" {
  local args
  args=$($JQ_BIN -r '.mcpServers."databricks-vector".args | join(" ")' plugins/databricks/.mcp.json)
  assert_matches "$args" "mcp-remote" "databricks-vector args should contain 'mcp-remote'"
}

@test "databricks .mcp.json databricks-uc config has command field" {
  local command
  command=$($JQ_BIN -r '.mcpServers."databricks-uc".command' plugins/databricks/.mcp.json)
  assert_eq "$command" "npx" "databricks-uc command should be 'npx'"
}

@test "databricks .mcp.json databricks-uc config has args array" {
  local args
  args=$($JQ_BIN -r '.mcpServers."databricks-uc".args | length' plugins/databricks/.mcp.json)
  [ "$args" -gt 0 ]
}

@test "databricks .mcp.json databricks-uc uses mcp-remote proxy" {
  local args
  args=$($JQ_BIN -r '.mcpServers."databricks-uc".args | join(" ")' plugins/databricks/.mcp.json)
  assert_matches "$args" "mcp-remote" "databricks-uc args should contain 'mcp-remote'"
}
