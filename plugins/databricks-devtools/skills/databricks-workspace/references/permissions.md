# Access Control Guide

## Permission Model

Databricks workspace uses a role-based access control system:

### Permission Levels

| Level | Description | Can View | Can Edit | Can Run | Can Manage |
|-------|-------------|----------|----------|---------|-----------|
| **CAN VIEW** | Read-only access | Yes | No | No | No |
| **CAN RUN** | Execute but not edit | Yes | No | Yes | No |
| **CAN EDIT** | Modify contents | Yes | Yes | Yes | No |
| **CAN MANAGE** | Full control | Yes | Yes | Yes | Yes |

### Default Permissions

| Location | Owner | Others |
|----------|-------|--------|
| `/Users/user@example.com/` | CAN MANAGE | No access |
| `/Shared/` | Varies | CAN VIEW (default) |
| `/Repos/` | Owner | No access (default) |
| `/FileStore/` | Owner | No access |

## Checking Permissions

### Using CLI

```bash
# List workspace with details
databricks workspace list /Users/user@example.com --output json

# Check if you can access
databricks workspace export /Users/user@example.com/Notebook /tmp/test.py
# Success = CAN VIEW or higher
# "Not found" or "Permission denied" = No access
```

### Permission Denied Indicators

```
Error: User does not have permission
HTTP 403 Forbidden
Resource not found (for existing paths)
```

## Granting Permissions

### Via UI

1. Open workspace
2. Right-click item
3. Share > Add users
4. Select permission level

### Via API

```bash
# Grant permissions on workspace object
databricks permissions set \
  --object-type workspace \
  --object-path "/Users/user@example.com/Notebook" \
  --access-control-list '[
    {
      "user_name": "colleague@example.com",
      "permission_level": "CAN_EDIT"
    }
  ]'
```

## User vs Group Permissions

### Individual Users

```json
{
  "user_name": "user@example.com",
  "permission_level": "CAN_EDIT"
}
```

### Groups

```json
{
  "group_name": "data-science-team",
  "permission_level": "CAN_EDIT"
}
```

**Best practice:** Use groups for team access to simplify management.

## Workspace Section Permissions

### `/Users/` - Private by Default

- Each user owns their folder
- No default access for others
- Explicit sharing required

### `/Shared/` - Collaboration Space

- Visible to all users (CAN VIEW)
- Modify requires explicit permissions
- Use for team notebooks

### `/Repos/` - Git Integration

- Repo creator gets CAN MANAGE
- Git sync doesn't change permissions
- Branch access follows workspace permissions

### `/FileStore/` - File Storage

- Uploader gets CAN MANAGE
- Shared via URL, not permissions
- Use for libraries, data files

## Service Principals

Service principals are non-user accounts for automation:

```bash
# Create service principal (via account console)
# Use in CLI like users

databricks --profile service-principal workspace list /
```

**Permission considerations:**
- Grant minimal required permissions
- Use for automated jobs and deployments
- Track access via audit logs

## Troubleshooting Permissions

### "Not Found" vs "Permission Denied"

| Situation | Error |
|-----------|-------|
| Path doesn't exist | `Resource does not exist` |
| No permission | Often same error (security by design) |
| Wrong workspace | `Not found` |

### Debugging Steps

```bash
# 1. Verify path exists (with permissions)
databricks workspace list /Users/user@example.com

# 2. Check current user
databricks current-user me

# 3. Try a known accessible path
databricks workspace list /

# 4. Check with different profile
databricks --profile other-user workspace list /Users/other@example.com
```

## Best Practices

### Principle of Least Privilege

```bash
# For execution only
CAN RUN

# For development
CAN EDIT

# For ownership
CAN MANAGE
```

### Team Organization

```
/Shared/
  ├── data-team/           # CAN EDIT for data team
  ├── engineering/         # CAN EDIT for engineering
  └── company-wide/        # CAN VIEW for all
```

### Audit Regularly

```bash
# List items in sensitive areas
databricks workspace list /Shared --output json | \
  jq -r '.[].path'

# Review access logs via workspace UI
```

### Migration Considerations

When moving items between workspaces:

```bash
# Export from source
databricks --profile source workspace export /path ./file.py

# Permissions do NOT transfer
# Re-establish permissions at destination
databricks --profile target workspace import ./file.py /path
# Then grant permissions via UI or API
```

## Security Considerations

### Sensitive Data

- Don't store credentials in notebooks
- Use Secret Scope for passwords/tokens
- Restrict access to CAN MANAGE for owners

### Audit Trail

- All permission changes are logged
- View via workspace UI > Audit Logs
- Track who accessed what and when

### Token-Based Access

Personal Access Tokens (PATs) inherit user permissions:

```bash
# Token for automation
# Generate in User Settings > Developer Tools
# Token inherits permissions of creating user
```

## Common Permission Workflows

### Sharing a Notebook

```bash
# 1. Move to Shared (optional)
databricks workspace import ./notebook.py /Shared/MyNotebook

# 2. Grant CAN EDIT to colleague
# (Via UI or permissions API)
```

### Creating a Team Folder

```bash
# 1. Create directory
databricks workspace mkdirs /Shared/team-projects

# 2. Grant CAN EDIT to team group
# (Via UI, share the folder with group)

# 3. Team members can now add notebooks
```

### Temporary Access

```bash
# Grant CAN VIEW for review
# Revoke after review period
# Document access requests
```
