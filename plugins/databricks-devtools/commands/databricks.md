---
name: databricks
description: Databricks workspace management - list profiles, show workspace info, manage resources
---

# Databricks Workspace Management

You are helping the user manage their Databricks workspace using the databricks-devtools plugin.

## How This Command Works

This command uses the databricks-devtools MCP tools to interact with Databricks workspaces:

1. **Profile Management**: List and select Databricks profiles from ~/.databrickscfg
2. **Workspace Information**: Display workspace details and configuration
3. **Resource Listing**: List clusters, warehouses, and other workspace resources
4. **Profile Selection**: Map git branches to specific Databricks environments

## Common Operations

### List Profiles

When the user asks to list or show profiles:

1. Use the MCP tool to list available profiles
2. Display each profile with key information:
   - Profile name
   - Host/workspace URL
   - Available cluster_id (if configured)
   - Available warehouse_id (if configured)

```text
User: /databricks list profiles
Bot: Available Databricks profiles:

     1. dev-profile (dev.cloud.databricks.com)
        - cluster_id: 1234-567890-abcde
        - warehouse_id: (not configured)

     2. prod-profile (prod.cloud.databricks.com)
        - cluster_id: (not configured)
        - warehouse_id: 9876-54321-edcba
```

### Show Workspace Info

When the user wants workspace information:

1. Check current git branch to determine profile (see Profile Selection below)
2. Use the MCP tool to get workspace details
3. Display relevant information about the workspace

### Profile Selection

The plugin uses **git branch mapping** to automatically select profiles:

**Git branch → Profile mapping:**

| Git Branch Pattern | Databricks Profile |
|--------------------|--------------------|
| `main`, `master`   | `DEFAULT` or first available |
| `feat/*`, `feature/*` | `dev` or `DEV` |
| `release/*` | `staging` or `STAGING` |
| `hotfix/*` | `prod` or `PROD` |

**Example:**

```text
Current git branch: feat/databricks
→ Using profile: dev
→ Workspace: dev.cloud.databricks.com
```

**Explicit profile selection:**

If the user specifies a profile, use that instead of the automatic mapping:

```text
User: Use the prod profile
Bot: Switching to prod profile
     Workspace: prod.cloud.databricks.com
```

### List Clusters

When the user wants to see clusters:

1. Use the selected profile
2. List clusters in the workspace
3. Show cluster status, size, and state

### List Warehouses

When the user wants to see SQL warehouses:

1. Use the selected profile
2. List SQL warehouses
3. Show warehouse status, size, and endpoint

## Important Notes

- **Profile configuration is in ~/.databrickscfg** - This is where Databricks CLI stores profiles
- **Git branch mapping is automatic** - The plugin detects the current branch and selects the appropriate profile
- **Multiple profiles supported** - Users can have dev, staging, prod profiles configured
- **Profile not configured?** - Guide the user to add the profile to ~/.databrickscfg

## Configuration Help

When a user needs help configuring profiles:

### ~/.databrickscfg Format

```ini
[dev]
host = https://dev.cloud.databricks.com
token = dapi123456789
cluster_id = 1234-567890-abcde

[prod]
host = https://prod.cloud.databricks.com
token = dapi987654321
warehouse_id = 9876-54321-edcba
```

### Getting Configuration Values

- **host**: The Databricks workspace URL
- **token**: Personal Access Token from Databricks user settings
- **cluster_id**: Cluster ID from workspace URL or cluster list
- **warehouse_id**: SQL Warehouse ID from warehouse settings

## Example Workflows

```text
User: /databricks list profiles
Bot: Available Databricks profiles:

     1. dev (dev.cloud.databricks.com)
        - cluster_id: 1234-567890-abcde
        - warehouse_id: (not configured)

     2. prod (prod.cloud.databricks.com)
        - cluster_id: (not configured)
        - warehouse_id: 9876-54321-edcba

     Current git branch: feat/databricks
     Active profile: dev
```

```text
User: Show me the clusters in prod
Bot: [Detects explicit "prod" request]
     Using profile: prod
     Workspace: prod.cloud.databricks.com

     Clusters in workspace:

     1. analytics-cluster (Running)
        - ID: 1111-2222-3333
        - Size: Medium
        - Runtime: 14.3 LTS

     2. etl-cluster (Terminated)
        - ID: 4444-5555-6666
        - Size: Large
        - Runtime: 15.4 LTS
```

## Related Commands

- `/databricks:sql` - Execute SQL queries via Databricks SQL warehouse
- See [using-databricks-devtools](../skills/using-databricks-devtools/SKILL.md) skill for complete usage guide
