<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# jira

## Purpose
Jira integration via Atlassian MCP server - create, search, and manage Jira issues.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Plugin documentation |
| `.mcp.json` | MCP server configuration |
| `.claude-plugin/plugin.json` | Plugin manifest |

## Subdirectories

None (MCP-based plugin)

## For AI Agents

### Working In This Directory
- MCP-based integration
- Requires Atlassian/Jira credentials
- No custom commands or skills (MCP handles)
- Configuration via .mcp.json

### Testing Requirements
- Test MCP server connectivity
- Verify Jira API authentication
- Test issue creation and retrieval

### Common Patterns
- MCP server URL in .mcp.json
- Authentication tokens from environment
- Skill activation automatic via MCP

## Dependencies

### External
- **Atlassian MCP Server** - External MCP server for Jira API
- **Jira Instance** - Target Jira instance

<!-- MANUAL: -->
