#!/usr/bin/env bats

# Tests for databricks plugin structure and validity

load helpers/bats_helper

setup() {
    ensure_jq
}

@test "databricks plugin directory exists" {
  [ -d "plugins/databricks" ]
}

@test "databricks .claude-plugin directory exists" {
  [ -d "plugins/databricks/.claude-plugin" ]
}

@test "databricks plugin.json exists" {
  [ -f "plugins/databricks/.claude-plugin/plugin.json" ]
}

@test "databricks .mcp.json exists" {
  [ -f "plugins/databricks/.mcp.json" ]
}

@test "databricks README.md exists" {
  [ -f "plugins/databricks/README.md" ]
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
  name=$(json_get plugins/databricks/.claude-plugin/plugin.json "name")
  [ "$name" = "databricks" ]
}

@test "databricks plugin.json has required version field" {
  version=$(json_get plugins/databricks/.claude-plugin/plugin.json "version")
  [ -n "$version" ]
  is_valid_semver "$version"
}

@test "databricks plugin.json has required description field" {
  description=$(json_get plugins/databricks/.claude-plugin/plugin.json "description")
  [ -n "$description" ]
}

@test "databricks plugin.json has required author field" {
  author=$($JQ_BIN -r '.author.name' plugins/databricks/.claude-plugin/plugin.json)
  [ -n "$author" ]
}

@test "databricks plugin registered in marketplace.json" {
  $JQ_BIN -e '.plugins[] | select(.name == "databricks")' .claude-plugin/marketplace.json
}

@test "databricks marketplace entry has matching version" {
  plugin_version=$($JQ_BIN -r '.version' plugins/databricks/.claude-plugin/plugin.json)
  marketplace_version=$($JQ_BIN -r '.plugins[] | select(.name == "databricks") | .version' .claude-plugin/marketplace.json)
  [ "$plugin_version" = "$marketplace_version" ]
}

@test "databricks marketplace entry has correct source path" {
  source=$($JQ_BIN -r '.plugins[] | select(.name == "databricks") | .source' .claude-plugin/marketplace.json)
  [ "$source" = "./plugins/databricks" ]
}

@test "databricks marketplace entry has category" {
  category=$($JQ_BIN -r '.plugins[] | select(.name == "databricks") | .category' .claude-plugin/marketplace.json)
  [ -n "$category" ]
}

@test "databricks marketplace entry has tags" {
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
  command=$($JQ_BIN -r '.mcpServers."databricks-sql".command' plugins/databricks/.mcp.json)
  [ "$command" = "npx" ]
}

@test "databricks .mcp.json databricks-sql config has args array" {
  args=$($JQ_BIN -r '.mcpServers."databricks-sql".args | length' plugins/databricks/.mcp.json)
  [ "$args" -gt 0 ]
}

@test "databricks .mcp.json databricks-sql uses mcp-remote proxy" {
  args=$($JQ_BIN -r '.mcpServers."databricks-sql".args | join(" ")' plugins/databricks/.mcp.json)
  [[ "$args" =~ mcp-remote ]]
}

@test "databricks .mcp.json databricks-vector config has command field" {
  command=$($JQ_BIN -r '.mcpServers."databricks-vector".command' plugins/databricks/.mcp.json)
  [ "$command" = "npx" ]
}

@test "databricks .mcp.json databricks-vector config has args array" {
  args=$($JQ_BIN -r '.mcpServers."databricks-vector".args | length' plugins/databricks/.mcp.json)
  [ "$args" -gt 0 ]
}

@test "databricks .mcp.json databricks-vector uses mcp-remote proxy" {
  args=$($JQ_BIN -r '.mcpServers."databricks-vector".args | join(" ")' plugins/databricks/.mcp.json)
  [[ "$args" =~ mcp-remote ]]
}

@test "databricks .mcp.json databricks-uc config has command field" {
  command=$($JQ_BIN -r '.mcpServers."databricks-uc".command' plugins/databricks/.mcp.json)
  [ "$command" = "npx" ]
}

@test "databricks .mcp.json databricks-uc config has args array" {
  args=$($JQ_BIN -r '.mcpServers."databricks-uc".args | length' plugins/databricks/.mcp.json)
  [ "$args" -gt 0 ]
}

@test "databricks .mcp.json databricks-uc uses mcp-remote proxy" {
  args=$($JQ_BIN -r '.mcpServers."databricks-uc".args | join(" ")' plugins/databricks/.mcp.json)
  [[ "$args" =~ mcp-remote ]]
}
