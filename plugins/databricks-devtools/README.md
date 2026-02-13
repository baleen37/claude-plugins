# Databricks SQL Schema Explorer Plugin

Databricks SQL schema exploration plugin for Claude Code.

## Purpose

This plugin is focused on SQL schema exploration through Databricks SQL Statements API.
It helps you browse Unity Catalog hierarchy, inspect table structure, and preview data.

## Features

- **Catalog discovery**: list available Unity Catalog catalogs
- **Schema discovery**: list schemas within a catalog
- **Table discovery**: list tables within a schema
- **Table inspection**: describe table columns and metadata
- **Data preview**: run `SELECT * ... LIMIT n` against a table
- **Profile-based execution**: optional profile selection from `~/.databrickscfg`
- **Automatic warehouse resolution**:
  - use profile `warehouse_id` when configured
  - otherwise pick the first running SQL warehouse from `databricks warehouses list`

## Prerequisites

### Databricks CLI

This plugin uses the Databricks CLI for authentication and command execution.

Install and verify:

```bash
brew install databricks
databricks --version
```

### Databricks profile configuration

Create `~/.databrickscfg` with one or more profiles.

```ini
[default]
host = https://your-workspace.cloud.databricks.com
token = dapiXXXXXXXX
warehouse_id = 1234567890abcdef

[alpha]
host = https://your-workspace.cloud.databricks.com
token = dapiYYYYYYYY
# warehouse_id optional - plugin can auto-discover running warehouse
```

## Slash command

### `/databricks:explore`

Single entry point for schema exploration.

- no args: list catalogs
- `catalog`: list schemas
- `catalog.schema`: list tables
- `catalog.schema.table`: describe table, show metadata, preview data

## MCP tools

The plugin exposes 6 tools:

1. `list_catalogs(profile?)`
2. `list_schemas(catalog, profile?)`
3. `list_tables(catalog, schema, profile?)`
4. `describe_table(table, profile?)` where `table` is fully qualified: `catalog.schema.table`
5. `table_metadata(table, profile?)` where `table` is fully qualified
6. `preview_data(table, limit?, profile?)` where `table` is fully qualified

## SQL execution behavior

Internally the plugin executes:

- `databricks api post /api/2.0/sql/statements --json <payload>`

Payload includes:

- `statement`: SQL text
- `warehouse_id`
- `wait_timeout: "30s"`

Errors from SQL statements are returned from `status.error.message`.

## Build and test

```bash
cd plugins/databricks-devtools
bun run build
bun run typecheck
bun run test
```

## Project structure

```text
plugins/databricks-devtools/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json
├── commands/
│   └── databricks.explore.md
├── skills/
│   └── using-databricks-explorer/
│       └── SKILL.md
├── src/
│   ├── cli/
│   │   ├── runner.ts
│   │   └── parser.ts
│   ├── config/
│   │   ├── databrickscfg.ts
│   │   ├── profiles.ts
│   │   └── types.ts
│   ├── sql/
│   │   └── executor.ts
│   └── mcp/
│       └── server.ts
├── tests/
│   ├── cli/
│   ├── config/
│   ├── mcp/
│   └── sql/
└── README.md
```
