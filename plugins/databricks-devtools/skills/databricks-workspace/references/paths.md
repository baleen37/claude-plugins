# Workspace Path Conventions

## Path Format

Databricks workspace paths follow a POSIX-style format:

```
/WorkspaceSection/Subsection/ItemName
```

- **Absolute paths** always start with `/`
- **Case-sensitive** - NoteBook and notebook are different
- **No trailing slash** for directories in CLI commands
- **Spaces allowed** but must be quoted in shell: `"/Users/user/My Notebook"`

## Standard Workspace Sections

### `/Users/` - Individual User Workspaces

```
/Users/user@example.com/Notebook
/Users/user@example.com/Project/Subdirectory/
```

- Each user gets a folder named after their email
- Full email address is required
- User has full control over their folder

### `/Shared/` - Team Collaboration

```
/Shared/Team Notebook
/Shared/Data Science/Models/
```

- Accessible to all workspace users
- Use for team-wide resources
- Requires CAN MANAGE permissions to modify

### `/Repos/` - Git Integration

```
/Repos/user@example.com/my-repo/
/Repos/user@example.com/my-repo/notebooks/etl.py
```

- Git repository integration
- Supports branch-based development
- Syncs with remote Git providers

### `/FileStore/` - Uploaded Files

```
/FileStore/tables/data.csv
/FileStore/jars/library.jar
/FileStore/plots/figure.png
```

- Uploaded files and libraries
- Web-accessible via workspace URL
- Commonly used for data storage

## Path Resolution

### Current User Detection

```bash
# Get current user email
databricks current-user me --output json | jq -r '.userName'

# Result: user@example.com
```

### Common Patterns

```bash
# User home base
/Users/$(databricks current-user me -o json | jq -r '.userName')

# Typical project structure
/Users/user@example.com/production/
/Users/user@example.com/development/
/Users/user@example.com/experiments/
```

## CLI Path Behavior

### Auto-Creation

```bash
# Creates parent directories automatically
databricks workspace mkdirs /Users/user@example.com/Project/Data/Models
```

### Trailing Slashes

```bash
# These are equivalent
databricks workspace list /Users/user@example.com
databricks workspace list /Users/user@example.com/

# Except in export-dir where trailing slash indicates contents
databricks workspace export-dir /Users/user@example.com/ ./backup
```

## Special Characters

| Character | Handling |
|-----------|----------|
| Space | Quote path: `"/Path/With Spaces"` |
| Quote | Escape with backslash: `\"` |
| Backslash | Double: `\\` |
| Unicode | Supported: `/Users/用户/笔记本` |

## Path Limits

- **Maximum length**: ~4000 characters (API limit)
- **Depth**: Practical limit ~20 levels
- **Recommendation**: Keep paths under 200 characters

## Common Pitfalls

### Wrong User Format

```bash
# Wrong - missing email domain
/Users/username/Notebook

# Correct
/Users/username@example.com/Notebook
```

### Relative vs Absolute

```bash
# Wrong - relative paths not supported
Users/user@example.com/Notebook

# Correct
/Users/user@example.com/Notebook
```

### Workspace Root

```bash
# List root (note: no /Users/ prefix)
databricks workspace list /

# This shows top-level folders: Users, Shared, Repos, FileStore
```
