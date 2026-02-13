---
name: databricks:explore
description: Explore Databricks Unity Catalog schema with SQL explorer tools
argument-hint: [<catalog|catalog.schema|catalog.schema.table>]
---

# Databricks SQL Schema Explorer

Use the databricks-devtools SQL explorer MCP tools:

- `list_catalogs`
- `list_schemas`
- `list_tables`
- `describe_table`
- `table_metadata`
- `preview_data`

## Command behavior

If no argument is provided:

1. Call `list_catalogs`
2. Show available catalogs

If argument is provided, interpret it as drill-down target:

- `<catalog>` → call `list_schemas`
- `<catalog>.<schema>` → call `list_tables`
- `<catalog>.<schema>.<table>` → call `describe_table`, `table_metadata`, then `preview_data`

Use `preview_data` with default limit unless the user explicitly requests a different row count.
