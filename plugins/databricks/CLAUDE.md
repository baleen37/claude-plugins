<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# databricks

## Purpose
Databricks integration via MCP server - execute SQL queries, manage clusters, and query Unity Catalog.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Plugin documentation |
| `.mcp.json` | MCP server configuration |
| `.claude-plugin/plugin.json` | Plugin manifest |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `skills/databricks-query/` | Databricks query skill |

## For AI Agents

### Working In This Directory
- MCP-based integration (Model Context Protocol)
- Requires Databricks workspace configuration
- Skill provides SQL query interface
- Manages cluster operations

### Testing Requirements
- Test MCP server connectivity
- Verify SQL query execution
- Test cluster management operations
- Validate Unity Catalog queries

### Common Patterns
- MCP configuration in `.mcp.json`
- Skill activated for Databricks-related queries
- Uses authentication tokens from environment

## Dependencies

### External
- **Databricks MCP Server** - External MCP server for Databricks API
- **Databricks Workspace** - Target workspace

### Internal
- `schemas/mcp-schema.json` - MCP configuration schema (if exists)

<!-- MANUAL: -->
