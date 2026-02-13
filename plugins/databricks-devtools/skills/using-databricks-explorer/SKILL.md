---
name: using-databricks-explorer
description: Use when exploring Databricks Unity Catalog structure, inspecting table schema, or previewing table data
---

# Using Databricks Explorer

The databricks-devtools plugin is a SQL schema explorer focused on Unity Catalog discovery.

## Available MCP tools

- `list_catalogs(profile?)`
- `list_schemas(catalog, profile?)`
- `list_tables(catalog, schema, profile?)`
- `describe_table(table, profile?)` where table is fully qualified (`catalog.schema.table`)
- `table_metadata(table, profile?)` where table is fully qualified (`catalog.schema.table`)
- `preview_data(table, limit?, profile?)` where table is fully qualified (`catalog.schema.table`)

All tools automatically resolve SQL warehouse from profile config:

1. Use `warehouse_id` from profile if present
2. Otherwise list warehouses and pick the first `RUNNING` warehouse

## Common exploration flow

1. `list_catalogs`
2. `list_schemas` for selected catalog
3. `list_tables` for selected schema
4. `describe_table` and `table_metadata` for selected table
5. `preview_data` for a quick sample

## Slash command

Use `/databricks:explore` as the single entry point:

- No args: list catalogs
- `catalog`: list schemas
- `catalog.schema`: list tables
- `catalog.schema.table`: describe + metadata + preview
