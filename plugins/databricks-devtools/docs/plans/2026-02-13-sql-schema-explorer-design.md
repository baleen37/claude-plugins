# SQL Schema Explorer - Design

## Goal

Rebuild databricks-devtools as a SQL schema exploration plugin.
Strip all non-SQL features. Provide MCP tools for browsing
Unity Catalog hierarchy, inspecting table structure, and previewing data.

## Architecture

### Connection

CLI wrapper using `databricks api post /api/2.0/sql/statements`.
The Databricks CLI handles auth and profile selection;
we send SQL via the Statements API and parse JSON responses.

**Why not raw CLI commands**: The `databricks api post` approach
returns structured JSON with consistent schema metadata,
whereas CLI commands like `warehouses list` return varying formats.

### Warehouse Discovery

Profiles in `~/.databrickscfg` may not include `warehouse_id`.
The plugin will:

1. Check profile for `warehouse_id`
2. If missing, call `databricks warehouses list` to find available warehouses
3. Use the first running warehouse

### Response Format

All SQL Statements API responses follow this shape:

```json
{
  "manifest": {
    "schema": {
      "columns": [
        { "name": "col_name", "type_name": "STRING", "position": 0 }
      ]
    },
    "total_row_count": 5
  },
  "result": {
    "data_array": [["val1", "val2"], ["val3", "val4"]]
  },
  "status": { "state": "SUCCEEDED" }
}
```

Note: all values in `data_array` are strings regardless of type.
Errors omit `manifest`/`result` and include `status.error.message`.

## What Gets Removed

- `skills/` - all 5 guide documents
- `commands/` - both slash commands (databricks, databricks:sql)
- MCP tools `list_profiles` and `get_profile_info`
- Git branch-to-profile mapping logic

## What Stays

- `src/cli/runner.ts` - CLI subprocess execution
- `src/config/` - `~/.databrickscfg` parsing
- `src/cli/parser.ts` - JSON parsing still useful
- Existing tests for retained code

## New Components

### `src/sql/executor.ts`

Common SQL execution function:

```typescript
interface SqlResult {
  columns: Array<{ name: string; type: string }>;
  rows: string[][];
  rowCount: number;
  truncated: boolean;
}

async function executeSql(
  sql: string,
  warehouseId: string,
  profile?: string
): Promise<SqlResult>;
```

Internally calls `databricks api post` and parses the JSON response.

### MCP Tools

| Tool | Parameters | SQL |
|---|---|---|
| `list_catalogs` | `profile?` | `SHOW CATALOGS` |
| `list_schemas` | `catalog`, `profile?` | `SHOW SCHEMAS IN <catalog>` |
| `list_tables` | `catalog`, `schema`, `profile?` | `SHOW TABLES IN <c>.<s>` |
| `describe_table` | `table`, `profile?` | `DESCRIBE TABLE <table>` |
| `table_metadata` | `table`, `profile?` | `DESCRIBE DETAIL <table>` |
| `preview_data` | `table`, `limit?`, `profile?` | `SELECT * LIMIT <n>` |

All tools auto-resolve warehouse from profile.

### `src/mcp/server.ts`

Rebuilt with 6 tools. Each tool:

1. Resolves warehouse ID from profile
2. Calls `executeSql` with the appropriate SQL
3. Formats result for MCP response

### Slash Command

`/databricks:explore` - single entry point.
Without args, lists catalogs.
With args, interprets as drill-down target.

### Skill

`using-databricks-explorer` - single guide for the 6 tools
and the slash command.

## File Structure

```text
src/
  cli/
    runner.ts        (retained)
    parser.ts        (retained, trimmed)
  config/
    databrickscfg.ts (retained)
    profiles.ts      (retained)
    types.ts         (retained)
  sql/
    executor.ts      (new)
  mcp/
    server.ts        (rebuilt)
commands/
  explore.md         (new, replaces old commands)
skills/
  using-databricks-explorer.md (new, replaces old skills)
```

## Error Handling

- **CLI not found**: `DatabricksNotFoundError` (existing)
- **No profile/invalid profile**: list available profiles
- **No warehouse**: error with setup instructions
- **SQL failure**: pass through `status.error.message` from API
- **Timeout**: 60s CLI subprocess; API `wait_timeout: "30s"`

## Testing

| Layer | What | Mock? |
|---|---|---|
| `executeSql` | CLI arg assembly, response parsing | Mock runner |
| MCP tools | SQL generation, param validation | Mock executor |
| Warehouse resolution | Profile lookup, fallback | Mock config+CLI |
| Error cases | CLI missing, bad profile, SQL error | Mock |
| Parser (existing) | JSON/table/psql parsing | No mocks |

Integration tests against real Databricks (alpha profile,
warehouse `c652016f1bbd9dae`) as separate suite with `e2e` marker.

## Verified API Behavior

Tested against alpha profile, warehouse `c652016f1bbd9dae`.

### Query Results

| Query | Columns | Notes |
|---|---|---|
| `SHOW CATALOGS` | `catalog` | 5 catalogs |
| `SHOW SCHEMAS` | `databaseName` | camelCase name |
| `SHOW TABLES` | `database, tableName, isTemporary` | 3 cols |
| `DESCRIBE TABLE` | `col_name, data_type, comment` | nullable |
| `DESCRIBE DETAIL` | 17 columns | metadata-rich |
| `SELECT *` | table schema | strings only |
| `COUNT(*)` | alias name | string value |

### Edge Cases

- **0 rows**: `chunks` absent, `result` is `{}` (empty object)
- **Errors**: no `manifest`/`result`, only `status.error`
- **All `data_array` values are strings** regardless of type_name
- **null values**: JSON `null` (not the string `"null"`)

### Catalog Structure

- `croquis_data_search` is under `unity` catalog
- `unity` has 141 schemas
- `hive_metastore` has 0 schemas (empty)
