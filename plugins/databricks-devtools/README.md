# Databricks DevTools Plugin

Databricks CLI wrapper plugin for Claude Code enabling workspace management and SQL execution.

## Purpose

This plugin provides Claude Code with direct access to Databricks workspaces through the Databricks CLI. It enables workspace management, SQL execution, and profile-based multi-environment support for data engineering and analytics workflows.

## Features

- **Workspace Management**: List workspaces, browse directories, manage notebooks and files
- **SQL Execution**: Run queries against Databricks SQL warehouses with result streaming
- **Profile-Based Configuration**: Support for multiple Databricks profiles/environments
- **CLI Wrapper**: Direct access to Databricks CLI commands through MCP tools

## Prerequisites

### Databricks CLI

This plugin requires the Databricks CLI to be installed and configured on your system.

**Installation:**

```bash
# Using Homebrew (macOS/Linux)
brew install databricks

# Using pip
pip install databricks-cli

# Or download from GitHub releases
# https://github.com/databricks/cli/releases
```

**Verify installation:**

```bash
databricks --version
```

### Configuration File

The plugin reads credentials from `~/.databrickscfg`. Create this file with your workspace profiles:

```ini
[default]
host = https://your-workspace.cloud.databricks.com
token = dapi123456789abcdef
cluster_id = 0123-456789-abcde0

[production]
host = https://prod-workspace.cloud.databricks.com
token = dapi987654321fedcba
warehouse_id = 1234567890abcdef

[staging]
host = https://staging-workspace.cloud.databricks.com
token = dapiabcdef123456789
warehouse_id = 0987654321fedcba
```

**Required fields per profile:**

- `host`: Databricks workspace URL (e.g., `https://your-workspace.cloud.databricks.com`)
- `token`: Personal access token (generate from Databricks workspace settings)
- `cluster_id` OR `warehouse_id`: Cluster for workspace operations, warehouse for SQL

**Generate a personal access token:**

1. Open your Databricks workspace
2. Click Settings -> User Settings
3. Go to Developer -> Generate new token
4. Copy the token (starts with `dapi`)
5. Add it to `~/.databrickscfg`

## Installation

```bash
cd plugins/databricks-devtools
npm install
npm run build
```

The plugin automatically:

1. Creates the MCP server bundle
2. Registers MCP tools for workspace and SQL operations
3. Provides slash commands for quick access

## Commands

### `/databricks`

Main command for Databricks workspace operations.

**Usage:**

- `databricks --profile <name>`: Specify profile (default: "default")
- `databricks workspace ls`: List workspace directory contents
- `databricks workspace mkdir`: Create directory
- `databricks notebooks export`: Export notebook
- `databricks repos list`: List Git repos in workspace

**Examples:**

```
# List workspace root
/databricks workspace ls /

# List notebooks in a folder
/databricks workspace ls /Users/your-email@example.com

# Use specific profile
/databricks --profile production workspace ls /
```

### `/databricks:sql`

Execute SQL queries against Databricks SQL warehouse.

**Usage:**

- `databricks:sql --profile <name>`: Specify profile with SQL warehouse
- `databricks:sql "SELECT ..."`: Execute SQL query

**Examples:**

```
# Simple query
/databricks:sql "SELECT * FROM schema.table LIMIT 10"

# With profile
/databricks:sql --profile production "SHOW TABLES"

# Complex query
/databricks:sql "
  SELECT
    date_column,
    COUNT(*) as count
  FROM analytics.events
  WHERE date_column >= CURRENT_DATE() - INTERVAL 7 DAYS
  GROUP BY date_column
  ORDER BY date_column
"
```

## MCP Tools

The plugin exposes the following MCP tools for programmatic access:

### `databricks__execute`

Execute any Databricks CLI command.

**Parameters:**

- `profile` (string, optional): Profile name from ~/.databrickscfg (default: "default")
- `command` (string, required): Databricks CLI command to execute

**Examples:**

```javascript
// List workspace
{
  profile: "default",
  command: "workspace ls /"
}

// Export notebook
{
  profile: "production",
  command: "workspace export /Users/user/Notebook ./output.py"
}

// List clusters
{
  profile: "default",
  command: "clusters list"
}
```

### `databricks__sql_execute`

Execute SQL query against Databricks SQL warehouse.

**Parameters:**

- `profile` (string, optional): Profile name with warehouse_id (default: "default")
- `query` (string, required): SQL query to execute
- `warehouse_id` (string, optional): Override warehouse ID from profile

**Examples:**

```javascript
// Simple query
{
  profile: "production",
  query: "SELECT * FROM users LIMIT 10"
}

// With warehouse override
{
  profile: "default",
  query: "SHOW TABLES",
  warehouse_id: "1234567890abcdef"
}
```

### `databricks__list_profiles`

List all configured profiles from ~/.databrickscfg.

**Returns:**

Array of profile names with their configuration (host, cluster_id, warehouse_id).

**Example:**

```javascript
{
  profiles: [
    {
      name: "default",
      host: "https://dev-workspace.cloud.databricks.com",
      cluster_id: "0123-456789-abcde0"
    },
    {
      name: "production",
      host: "https://prod-workspace.cloud.databricks.com",
      warehouse_id: "1234567890abcdef"
    }
  ]
}
```

## Profile-to-Branch Mapping

For multi-environment workflows, profiles can map to Git branches:

| Profile | Environment | Git Branch | Use Case |
|---------|-------------|------------|----------|
| `default` | Development | `main` / `feat/*` | Local development |
| `staging` | Staging | `staging` | Pre-production testing |
| `production` | Production | `main` / `release/*` | Production workloads |

**Example workflow:**

```bash
# Work on feature branch (uses default profile)
git checkout -b feature/new-dashboard

# Test on staging (uses staging profile)
/databricks --profile staging workspace ls /

# Run production query (uses production profile)
/databricks:sql --profile production "
  SELECT COUNT(*) FROM production.analytics.events
"
```

## Usage Examples

### Explore Workspace

```bash
# List workspace root
/databricks workspace ls /

# Navigate to user folder
/databricks workspace ls /Users/your-email@example.com

# Export a notebook
/databricks workspace export /Users/user/Analysis ./analysis.py

# List clusters
/databricks clusters list
```

### SQL Analytics

```bash
# Show tables
/databricks:sql "SHOW TABLES IN analytics"

# Run aggregation
/databricks:sql "
  SELECT
    product_category,
    SUM(revenue) as total_revenue
  FROM analytics.sales
  GROUP BY product_category
  ORDER BY total_revenue DESC
"

# Get table schema
/databricks:sql "DESCRIBE TABLE analytics.users"
```

### Multi-Environment Queries

```bash
# Compare staging vs production
/databricks:sql --profile staging "SELECT COUNT(*) FROM events"
/databricks:sql --profile production "SELECT COUNT(*) FROM events"
```

## Project Structure

```text
plugins/databricks-devtools/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── .mcp.json                     # MCP server registration
├── commands/
│   └── databricks.md            # Slash command definitions
├── skills/
│   └── databricks-ops/          # Skills for Databricks operations
├── src/
│   ├── config/                  # Configuration management
│   │   ├── types.ts             # Type definitions
│   │   └── databrickscfg.ts     # Config parser
│   ├── cli/                     # CLI runner modules
│   │   ├── runner.ts            # Databricks CLI execution
│   │   └── parser.ts            # Output parsing
│   └── mcp/
│       └── server.ts            # MCP server (tools: execute, sql_execute, list_profiles)
├── dist/
│   ├── mcp-server.mjs           # Bundled MCP server
│   └── mcp-wrapper.mjs          # Cross-platform wrapper
├── scripts/
│   ├── build.mjs                # esbuild config
│   └── mcp-server-wrapper.mjs   # Wrapper script
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Build

```bash
npm run build
```

Bundles `src/mcp/server.ts` → `dist/mcp-server.mjs`

### Type Check

```bash
npm run typecheck
```

## Troubleshooting

### Databricks CLI Not Found

**Symptoms:** Error "databricks: command not found"

**Fix:**

1. Verify Databricks CLI installation:

```bash
databricks --version
```

2. If not installed, follow the installation instructions above

3. Ensure the CLI is in your PATH:

```bash
which databricks
```

### Authentication Errors

**Symptoms:** "Error: Invalid token" or "Error: Authentication failed"

**Fix:**

1. Verify your personal access token is valid in the Databricks workspace
2. Check that `~/.databrickscfg` has the correct format
3. Regenerate the token if expired

### Permission Denied (EACCES)

**Symptoms:** Error during dependency installation

**Fix:**

```bash
sudo chown -R $(whoami) ~/.npm
```

### Network Errors

**Symptoms:** ETIMEDOUT, ECONNRESET during installation

**Fix:**

1. Check internet connection
2. Configure npm proxy if behind firewall:

```bash
npm config set proxy http://your-proxy:port
npm config set https-proxy http://your-proxy:port
```

### Manual Installation

If automatic installation fails:

```bash
cd plugins/databricks-devtools
npm install
npm run build
```

## Architecture Notes

- **CLI Wrapper**: Plugin wraps Databricks CLI (not a native SDK)
- **Configuration**: Reads from `~/.databrickscfg` (standard Databricks location)
- **Profile Support**: Multi-environment support through profile selection
- **Execution**: All commands execute through `databricks` CLI subprocess
- **Security**: Tokens stored in local config file (never transmitted)

## Dependencies

### Runtime

- `@modelcontextprotocol/sdk`: ^1.0.4 - MCP protocol implementation
- `zod`: ^3.23.8 - Schema validation

### Development

- `typescript`: ^5.3.3
- `esbuild`: ^0.20.0
- `@types/node`: ^20.0.0

## References

- Databricks CLI: https://github.com/databricks/cli
- Databricks REST API: https://docs.databricks.com/dev-tools/api/latest/
- MCP Protocol: https://modelcontextprotocol.io

## License

MIT
