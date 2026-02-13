---
name: using-databricks-explorer
description: Use when a user asks to browse Databricks Unity Catalog or inspect a table using targets like <catalog>, <catalog>.<schema>, or <catalog>.<schema>.<table>.
---

# Using Databricks Explorer

## Overview

Use Databricks SQL explorer MCP tools for Unity Catalog drill-down. Interpret the target shape, then call MCP tools directly.

## When to Use

Use this skill when the user wants to:

- list catalogs, schemas, or tables in Unity Catalog
- inspect table columns and metadata
- preview sample rows from a specific table

Do not use this skill for:

- write operations (`INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`)
- bulk export requests

## Quick Reference

| User target | Default MCP tool calls |
| --- | --- |
| *(no target)* | `list_catalogs` |
| `<catalog>` | `list_schemas(catalog)` |
| `<catalog>.<schema>` | `list_tables(catalog, schema)` |
| `<catalog>.<schema>.<table>` | `describe_table(table)` → `table_metadata(table)` → `preview_data(table)` |

If the user explicitly asks for only one output (for example, columns only), call only the relevant table-level tool.

### Tool signatures

- `list_catalogs(profile?)`
- `list_schemas(catalog, profile?)`
- `list_tables(catalog, schema, profile?)`
- `describe_table(table, profile?)`
- `table_metadata(table, profile?)`
- `preview_data(table, limit?, profile?)`

For `describe_table`, `table_metadata`, and `preview_data`, `table` must be fully qualified: `<catalog>.<schema>.<table>`.

## Parsing Rule

- Treat `/databricks:explore` as the command prefix only.
- Parse the remaining token as target shape: *(none)*, `<catalog>`, `<catalog>.<schema>`, or `<catalog>.<schema>.<table>`.
- Execute MCP tools directly from target shape; do not re-invoke slash command as a skill.

## Limit Rules

- `preview_data` default limit is `10`.
- Valid `limit` is an integer from `1` to `1000`.
- If the user requests more than `1000` rows, explain the limit and ask whether to proceed with `1000`.

## Common Mistakes

- Treating `/databricks:explore` as a skill invocation instead of running MCP tools.
- Guessing unsupported flags or argument formats.
- Calling table-level tools with partial targets (for example, `<catalog>.<schema>`).
- Sending `preview_data` with `limit > 1000`.

## Examples

User request:

`/databricks:explore main.sales.orders`

Tool sequence:

1. `describe_table(table: "main.sales.orders")`
2. `table_metadata(table: "main.sales.orders")`
3. `preview_data(table: "main.sales.orders")`

Then return a concise summary of columns, key metadata, and sample rows.

User request with profile:

`Show tables in main.sales using profile alpha`

Tool sequence:

1. `list_tables(catalog: "main", schema: "sales", profile: "alpha")`
