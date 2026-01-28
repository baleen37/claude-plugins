---
name: databricks-query
description: Use when user asks about Databricks queries, SQL, Unity Catalog, vector search, or cluster status
---

# Databricks Query

Assist with Databricks data querying, SQL generation, Unity Catalog navigation, and vector search operations.

## When to Use

Use when user asks:

- "Convert this to SQL" / "Write a query for..."
- "What tables do we have?" / "Show me the schema"
- "Search for similar..." / "Vector search..."
- "Is the cluster running?" / "Warehouse status"
- "Query Unity Catalog" / "UC functions"

Do NOT use when:

- User wants general SQL help (not Databricks-specific)
- User asks about non-Databricks databases

## Core Capabilities

### Natural Language to SQL

Convert natural language questions into Databricks SQL queries:

1. **Understand the intent**: Identify what data the user wants
2. **Identify the source**: Determine which catalog/schema/table
3. **Generate SQL**: Write proper Databricks SQL syntax
4. **Execute using MCP**: Use `mcp__databricks__execute_sql`

**Example patterns:**

- "Show me top 10 customers" → `SELECT * FROM catalog.schema.customers ORDER BY revenue DESC LIMIT 10`
- "Count users by region" → `SELECT region, COUNT(*) FROM catalog.schema.users GROUP BY region`
- "Sales this month" → `SELECT SUM(amount) FROM catalog.schema.sales WHERE sale_date >= DATE_TRUNC('month', CURRENT_DATE())`

### Unity Catalog Schema Reference

Help users navigate Unity Catalog three-level namespace:

```text
catalog.schema.table
```

**Available MCP tools:**

- `mcp__databricks__execute_sql`: Query information_schema for schema discovery
- `mcp__databricks__list_functions`: List Unity Catalog functions
- `mcp__databricks__execute_function`: Execute UC functions

**Schema discovery queries:**

```sql
-- List all catalogs
SHOW CATALOGS;

-- List schemas in a catalog
SHOW SCHEMAS IN catalog_name;

-- List tables in a schema
SHOW TABLES IN catalog_name.schema_name;

-- Get table schema
DESCRIBE catalog_name.schema_name.table_name;

-- List columns with types
SELECT * FROM information_schema.columns
WHERE table_schema = 'schema_name'
AND table_name = 'table_name';
```

### Vector Search Query Writing

Assist with Databricks Vector Search (similarity search):

**Available MCP tools:**

- `mcp__databricks__vector_search`: Execute vector similarity search
- `mcp__databricks__list_indexes`: List available vector indexes

**Vector search patterns:**

1. **Find the index**: Use `list_indexes` to discover available vector indexes
2. **Construct query**: Build similarity search with embedding vector
3. **Execute search**: Use `vector_search` MCP tool

**Example workflow:**

```python
# 1. List available indexes
mcp__databricks__list_indexes()

# 2. Execute vector search
mcp__databricks__vector_search(
    index_name="catalog.schema.vector_index",
    query_vector=[0.1, 0.2, ...],  # Embedding vector
    k=10  # Top K results
)
```

**Note**: Vector search requires:

- Existing vector index in Unity Catalog
- Query embedding vector (user must provide or generate)
- Specify K (number of results)

### Cluster Status Checking

Monitor and check Databricks SQL Warehouse status:

**Available MCP tools:**

- `mcp__databricks__list_warehouses`: List all SQL warehouses
- `mcp__databricks__get_warehouse_info`: Get detailed warehouse status

**Status workflow:**

1. **List warehouses**: Get all available warehouses
2. **Check status**: Verify if warehouse is RUNNING, STARTING, or STOPPED
3. **Get details**: Warehouse size, state, creator info

**Warehouse states:**

- `RUNNING`: Ready to execute queries
- `STARTING`: Warehouse is starting up
- `STOPPING`: Warehouse is shutting down
- `STOPPED`: Warehouse is stopped
- `DELETING`: Warehouse is being deleted

## Quick Reference

| Task | MCP Tool | Notes |
|------|----------|-------|
| Execute SQL | `mcp__databricks__execute_sql` | Requires warehouse_id |
| List warehouses | `mcp__databricks__list_warehouses` | Check status first |
| Warehouse details | `mcp__databricks__get_warehouse_info` | Get warehouse_id from list |
| Vector search | `mcp__databricks__vector_search` | Requires index_name and query_vector |
| List vector indexes | `mcp__databricks__list_indexes` | Discover available indexes |
| List UC functions | `mcp__databricks__list_functions` | Unity Catalog functions |
| Execute UC function | `mcp__databricks__execute_function` | Requires function_name |

## Best Practices

### SQL Generation

1. **Always qualify tables**: Use three-level namespace (catalog.schema.table)
2. **Filter by date**: Most queries should have date filters for performance
3. **Limit results**: Add LIMIT clause during development
4. **Use CTEs**: Complex queries benefit from Common Table Expressions
5. **Test incrementally**: Start with simple queries, add complexity

### Schema Discovery

1. **Start broad**: SHOW CATALOGS → SHOW SCHEMAS → SHOW TABLES
2. **Use information_schema**: For programmatic schema exploration
3. **Check column types**: DESCRIBE table before querying
4. **Look for sample data**: SELECT * LIMIT 10 to understand data

### Vector Search

1. **Verify index exists**: Use `list_indexes` before searching
2. **Provide correct embedding**: Query vector must match index dimension
3. **Adjust K parameter**: Start with K=10, adjust based on needs
4. **Handle no results**: Empty results mean no similar vectors found

### Warehouse Status

1. **Check before query**: Verify warehouse is RUNNING
2. **Use smallest warehouse**: Development doesn't need large warehouses
3. **Auto-start is okay**: Querying a STOPPED warehouse will auto-start
4. **Monitor costs**: Larger warehouses cost more per hour

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Unqualified table names | Use `catalog.schema.table` |
| Missing warehouse_id | Get from `list_warehouses` first |
| Wrong embedding dimension | Match index dimension exactly |
| No date filters on large tables | Add WHERE clause with date filter |
| Forgetting LIMIT in dev | Add LIMIT to avoid long-running queries |

## Example Workflows

### Workflow 1: Ad-hoc Data Query

```text
User: "Show me revenue by product category"

1. Check warehouse status (list_warehouses)
2. Generate SQL with catalog.schema.table
3. Execute query (execute_sql)
4. Present results with interpretation
```

### Workflow 2: Schema Exploration

```text
User: "What customer data do we have?"

1. List catalogs (SHOW CATALOGS)
2. Find relevant schema (SHOW SCHEMAS)
3. List tables (SHOW TABLES)
4. Describe key tables (DESCRIBE)
5. Show sample data (SELECT * LIMIT 10)
```

### Workflow 3: Vector Similarity Search

```text
User: "Find documents similar to this text"

1. List vector indexes (list_indexes)
2. Generate embedding for query text
3. Execute vector search (vector_search)
4. Return top K similar items with scores
```

### Workflow 4: Pre-Query Validation

```text
User: "Run this analytics query"

1. Check warehouse status (get_warehouse_info)
2. Validate table exists (information_schema)
3. Review query plan (EXPLAIN if available)
4. Execute with LIMIT first
5. Run full query if LIMIT results look correct
```

## Databricks SQL Tips

- **Date functions**: `CURRENT_DATE()`, `DATE_TRUNC()`, `DATE_ADD()`
- **String functions**: `UPPER()`, `LOWER()`, `TRIM()`, `SUBSTRING()`
- **Aggregations**: Standard SQL with `GROUP BY`, `HAVING`
- **Window functions**: `ROW_NUMBER()`, `RANK()`, `LAG()`, `LEAD()`
- **Semi-structured**: Use `:` operator for JSON fields in Variant columns

## Unity Catalog Notes

- **Three-level namespace**: Always use `catalog.schema.table`
- **Privileges**: User needs SELECT on tables, USE SCHEMA on schemas
- **Functions**: Unity Catalog functions can be called in SQL queries
- **Managed vs External**: Managed tables in catalog, external at cloud storage
