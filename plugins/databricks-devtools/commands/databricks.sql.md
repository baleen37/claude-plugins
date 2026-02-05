---
name: databricks:sql
description: Execute SQL queries via Databricks SQL warehouse
argument-hint: [<query>]
---

# Databricks SQL Execution

You are helping the user execute SQL queries on Databricks using the databricks-devtools plugin.

## How This Command Works

This command uses the databricks-devtools MCP tools to execute SQL queries:

1. **Profile Selection**: Automatically selects profile based on git branch
2. **Warehouse Selection**: Uses warehouse_id from profile or prompts for selection
3. **Query Execution**: Executes SQL via Databricks SQL endpoint
4. **Result Formatting**: Formats and displays query results

## Query Execution Flow

### Step 1: Determine Profile

Check current git branch to select profile (see `/databricks` command for mapping rules).

```text
Current git branch: feat/analytics
→ Using profile: dev
→ Workspace: dev.cloud.databricks.com
```

### Step 2: Select Warehouse

Check if the selected profile has a `warehouse_id` configured:

**If warehouse_id exists:**
- Use that warehouse for query execution

**If warehouse_id missing:**
- List available warehouses in the workspace
- Prompt user to select a warehouse
- Optionally save the warehouse_id to the profile

### Step 3: Execute Query

Use the MCP tool to execute the SQL query.

### Step 4: Display Results

Format and present the query results in a readable table format.

## Important Notes

### SQL Warehouse Session Creation

**⚠️ Important:** The first SQL query to a warehouse creates a new session. This can take 10-30 seconds.

**Performance tip:** Minimize warehouse switches. The session is reused for subsequent queries on the same warehouse.

**Example:**

```text
User: /databricks:sql SELECT * FROM users LIMIT 10
Bot: [First query - creating session]
     Creating SQL warehouse session... (this may take 10-30 seconds)
     Session created successfully

     Query results:
     | id | name       | email                |
     |----|------------|----------------------|
     | 1  | Alice      | alice@example.com    |
     | 2  | Bob        | bob@example.com      |
     ...

User: /databricks:sql SELECT COUNT(*) FROM users
Bot: [Reusing existing session - fast]
     Query results:
     | count |
     |-------|
     | 1523  |
```

### Query Tips

Help the user write effective queries:

- **Use LIMIT** for exploratory queries: `SELECT * FROM table LIMIT 100`
- **Filter with WHERE** to reduce data: `SELECT * FROM events WHERE date >= '2025-01-01'`
- **Use COUNT(*)** to check table size before full scans
- **Consider warehouse size** - Large datasets may need larger warehouses

### Common Query Patterns

**Table exploration:**
```sql
-- Show table schema
DESCRIBE table_name

-- Sample data
SELECT * FROM table_name LIMIT 100

-- Count rows
SELECT COUNT(*) FROM table_name
```

**Data analysis:**
```sql
-- Group by and aggregate
SELECT category, COUNT(*), AVG(value)
FROM events
GROUP BY category
ORDER BY COUNT(*) DESC

-- Time series
SELECT DATE(timestamp), COUNT(*)
FROM events
GROUP BY DATE(timestamp)
ORDER BY DATE(timestamp)
```

**Data quality checks:**
```sql
-- Null checks
SELECT COUNT(*) FROM table WHERE column IS NULL

-- Duplicate checks
SELECT column, COUNT(*) as count
FROM table
GROUP BY column
HAVING COUNT(*) > 1
```

## Example Workflows

```text
User: /databricks:sql SHOW DATABASES
Bot: Current git branch: feat/analytics
     Using profile: dev
     Warehouse: dev_warehouse (id: 9876-54321-edcba)

     Query results:
     | database    |
     |-------------|
     | default     |
     | analytics   |
     | staging     |
     | raw         |
```

```text
User: /databricks:sql SELECT * FROM analytics.user_events LIMIT 10
Bot: Using warehouse: dev_warehouse

     Query results:
     | event_id | user_id | event_type   | timestamp            |
     |----------|---------|--------------|----------------------|
     | 1001     | 45      | page_view    | 2025-02-05 10:23:45  |
     | 1002     | 45      | click        | 2025-02-05 10:24:12  |
     | 1003     | 78      | page_view    | 2025-02-05 10:25:33  |
     ...
```

## Warehouse Selection

When no warehouse_id is configured in the profile:

```text
User: /databricks:sql SELECT 1
Bot: No warehouse_id configured for profile "dev"

     Available warehouses:

     1. dev_warehouse (Small, Running)
        ID: 1111-2222-3333
        Endpoint: sql/protocolv1/o/1234/1111-2222-3333

     2. analytics_warehouse (Medium, Idle)
        ID: 4444-5555-6666
        Endpoint: sql/protocolv1/o/1234/4444-5555-6666

     Which warehouse would you like to use? (Enter number or ID)

User: 1
Bot: Selected: dev_warehouse
     [Optional: Would you like to save this warehouse_id to your dev profile?]

     Query results:
     | 1 |
     |---|
     | 1 |
```

## Configuration

### Setting warehouse_id in Profile

Edit `~/.databrickscfg`:

```ini
[dev]
host = https://dev.cloud.databricks.com
token = dapi123456789
warehouse_id = 1111-2222-3333
```

### Switching Warehouses

**Temporary switch:**
```text
User: Use the analytics_warehouse
Bot: Switched to analytics_warehouse (id: 4444-5555-6666)
     [New session will be created - first query will be slower]
```

**Permanent switch (save to profile):**
Update the `warehouse_id` in `~/.databrickscfg`

## Related Commands

- `/databricks` - List profiles, show workspace info, list warehouses
- See [using-databricks-devtools](../skills/using-databricks-devtools/SKILL.md) skill for complete usage guide

## Troubleshooting

**"Warehouse not found"**
- Verify warehouse_id in profile
- Check if you have access to the warehouse
- Use `/databricks` to list available warehouses

**"Session creation taking too long"**
- First query always creates a session (10-30 seconds)
- Subsequent queries on same warehouse are fast
- Consider keeping warehouse running (avoid auto-stop)

**"Query timeout"**
- Large queries may take longer
- Consider increasing warehouse size
- Add filters or LIMIT to reduce data volume

**"Permission denied"**
- Verify token has SQL warehouse access
- Check workspace permissions
- Contact workspace admin
