---
name: using-databricks-devtools
description: Use when working with Databricks workspace, executing SQL queries, or managing Databricks resources
---

# Using Databricks DevTools

## Overview

The databricks-devtools plugin provides Databricks workspace management and SQL execution capabilities through MCP tools.

**Core principle:** Git branch mapping to Databricks profiles = automatic environment selection.

## When to Use

Use this plugin when the user:

- Asks about Databricks workspace, clusters, or warehouses
- Wants to execute SQL queries on Databricks
- Needs to list or manage Databricks resources
- References Databricks-specific operations
- Asks about data in a Databricks workspace
- Needs to check workspace configuration

## Profile Selection

### Automatic Git Branch Mapping

The plugin automatically selects Databricks profiles based on the current git branch:

| Git Branch Pattern | Databricks Profile |
|--------------------|--------------------|
| `main`, `master`   | `DEFAULT` or first available |
| `feat/*`, `feature/*` | `dev` or `DEV` |
| `release/*` | `staging` or `STAGING` |
| `hotfix/*` | `prod` or `PROD` |

**Example:**

```text
Current git branch: feat/analytics-feature
→ Automatically using profile: dev
→ Workspace: dev.cloud.databricks.com
```

### Manual Profile Selection

User can override automatic selection:

```text
User: Use the prod profile
Bot: Switched to prod profile
     Workspace: prod.cloud.databricks.com
```

### Configuration File

Profiles are stored in `~/.databrickscfg`:

```ini
[dev]
host = https://dev.cloud.databricks.com
token = dapi123456789
cluster_id = 1234-567890-abcde
warehouse_id = 1111-2222-3333

[prod]
host = https://prod.cloud.databricks.com
token = dapi987654321
warehouse_id = 4444-5555-6666
```

## Common Workflows

### 1. List Available Profiles

```text
User: Show my Databricks profiles
Bot: /databricks list profiles
```

### 2. Explore Workspace

```text
User: What clusters are available in dev?
Bot: [Detects "dev" context]
     /databricks list clusters
```

### 3. Execute SQL Query

```text
User: How many users do we have?
Bot: [Detects SQL context]
     /databricks:sql SELECT COUNT(*) FROM users
```

### 4. Check Warehouse Status

```text
User: Are the SQL warehouses running?
Bot: /databricks list warehouses
```

## SQL Execution Patterns

### First Query (Session Creation)

**Important:** The first SQL query creates a new session (10-30 seconds).

```text
User: /databricks:sql SELECT 1
Bot: Creating SQL warehouse session... (10-30 seconds)
     Session created successfully

     Query results:
     | 1 |
     |---|
     | 1 |
```

### Subsequent Queries

Same warehouse = fast (reuses session):

```text
User: /databricks:sql SELECT NOW()
Bot: [Reusing session - instant]
     Query results:
     | now()               |
     |---------------------|
     | 2025-02-05 14:23:45 |
```

### Exploratory Queries

Help users explore data safely:

```sql
-- Check table exists
SHOW TABLES

-- Show schema
DESCRIBE table_name

-- Sample data
SELECT * FROM table_name LIMIT 100

-- Count before scan
SELECT COUNT(*) FROM table_name
```

## MCP Tools

The plugin provides these MCP tools:

### list_profiles

List all Databricks profiles from ~/.databrickscfg

```json
{
  "profiles": [
    {
      "name": "dev",
      "host": "https://dev.cloud.databricks.com",
      "cluster_id": "1234-567890-abcde",
      "warehouse_id": "1111-2222-3333"
    }
  ]
}
```

### get_profile

Get details for a specific profile

```json
{
  "profile": "dev"
}
```

### list_clusters

List clusters in the workspace

```json
{
  "profile": "dev"
}
```

### list_warehouses

List SQL warehouses in the workspace

```json
{
  "profile": "dev"
}
```

### execute_sql

Execute a SQL query

```json
{
  "profile": "dev",
  "warehouse_id": "1111-2222-3333",
  "query": "SELECT * FROM users LIMIT 10"
}
```

## Response Format

Present query results in a clean table format:

```text
Query results:
| id | name       | email                |
|----|------------|----------------------|
| 1  | Alice      | alice@example.com    |
| 2  | Bob        | bob@example.com      |
| 3  | Charlie    | charlie@example.com  |

(3 rows, 0.45 seconds)
```

## Best Practices

### Performance

- **Reuse warehouse sessions** - Minimize warehouse switches
- **Use LIMIT** - Avoid full table scans
- **Filter early** - Use WHERE to reduce data
- **Check size first** - COUNT(*) before SELECT *

### Safety

- **Test on dev first** - Use automatic branch mapping
- **Use transactions** - Wrap writes in transactions
- **Validate data** - Check row counts after operations
- **Backup critical data** - Before destructive operations

### User Experience

- **Announce profile selection** - Show which profile is being used
- **Warn on session creation** - Explain first-query delay
- **Show query time** - Help users understand performance
- **Suggest optimizations** - LIMIT, WHERE, indexes

## Quick Reference

| Task | Command |
|------|---------|
| List profiles | `/databricks list profiles` |
| Show workspace | `/databricks info` |
| List clusters | `/databricks list clusters` |
| List warehouses | `/databricks list warehouses` |
| Execute SQL | `/databricks:sql SELECT ...` |
| Switch profile | "Use the [profile] profile" |

## Related Documentation

- [databricks command](../../commands/databricks.md) - Workspace management
- [databricks:sql command](../../commands/databricks.sql.md) - SQL execution details
- [Databricks CLI docs](https://docs.databricks.com/dev-tools/cli/index.html) - Official CLI reference

## Troubleshooting

**"Profile not found"**
- Check ~/.databrickscfg exists
- Verify profile name matches
- Check file format (INI-style)

**"Warehouse not found"**
- Verify warehouse_id in profile
- Use `/databricks list warehouses` to find correct ID
- Check workspace permissions

**"Session creation timeout"**
- First query takes 10-30 seconds
- Check warehouse is running
- Verify network connectivity

**"Query timeout"**
- Reduce data volume with LIMIT/WHERE
- Increase warehouse size for large queries
- Check query execution plan
