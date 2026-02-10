---
name: databricks-workspace
description: |
  This skill should be used when the user asks to "list databricks workspace",
  "export databricks notebook", "import databricks notebook", "databricks
  workspace directories", or needs guidance on Databricks workspace
  management, notebook operations, or file management.
version: 1.0.0
---

# Databricks Workspace Management

## Overview

The Databricks workspace stores notebooks, libraries, and other files. This skill covers workspace navigation, notebook import/export, and file management operations.

## Workspace Structure

### Default Layout

```text
/
├── Users/
│   └── user@example.com/
│       ├── Notebook1
│       └── Project/
│           └── Notebook2
├── Shared/
│   └── Shared notebooks
├── Repos/
│   └── Git repository integrations
└── FileStore/
    └── Uploaded files and visualizations
```

### Understanding Paths

- **Absolute paths**: Start with `/`
- **User folder**: `/Users/user@example.com/`
- **Shared**: `/Shared/`
- **FileStore**: `/FileStore/`

## Listing Workspace Items

### List Root Directory

```bash
databricks workspace list /
```

### List Subdirectory

```bash
databricks workspace list /Users/user@example.com
```

### List with Details

```bash
databricks workspace list --output json /Users/user@example.com
```

**Output includes:**
- Object type (Directory, Notebook)
- Last modified timestamp
- File size (for objects)
- Object ID
- Language (for notebooks)

### Recursive Listing

```bash
# List all items recursively
databricks workspace list --recursive /
```

## Creating Directories

### Create Directory

```bash
databricks workspace mkdirs /Users/user@example.com/Project
```

**Note**: Creates parent directories if they don't exist.

### Create Nested Directory

```bash
databricks workspace mkdirs /Users/user@example.com/Project/Subdirectory/Data
```

## Exporting Notebooks

### Export Single Notebook

```bash
# Export notebook to current directory
databricks workspace export /Users/user@example.com/Notebook ./notebook.py

# Export to specific location
databricks workspace export /Users/user@example.com/Notebook /path/to/output.py
```

**Export Formats:**

- `.py` - Python source code
- `.scala` - Scala source code
- `.r` - R source code
- `.sql` - SQL source code
- `.html` - HTML file with input/output cells

**Databricks CLI auto-detects language by extension.**

### Export Directory

```bash
# Export directory and contents
databricks workspace export-dir /Users/user@example.com/Project ./local-project
```

**Exported structure includes:**
- Notebooks (as .py, .scala, etc.)
- Subdirectories (preserved)
- Non-notebook files (if any)

### Export All User Notebooks

```bash
# Backup entire user folder
databricks workspace export-dir /Users/user@example.com ./backup-$(date +%Y%m%d)
```

## Importing Notebooks

### Import Single Notebook

```bash
# Import Python notebook
databricks workspace import ./notebook.py /Users/user@example.com/Notebook

# Import to specific location
databricks workspace import ./notebook.py /Users/user@example.com/Project/Notebook

# Specify language explicitly
databricks workspace import ./notebook.py /Users/user@example.com/Notebook --language PYTHON
```

**Supported languages:**
- `PYTHON` - Python notebook
- `SCALA` - Scala notebook
- `R` - R notebook
- `SQL` - SQL notebook
- `DATABRICKS-SCALA` - Databricks Scala

### Import Directory

```bash
# Import local directory to workspace
databricks workspace import-dir ./local-project /Users/user@example.com/RemoteProject
```

**Import behavior:**
- Creates directory structure
- Imports all notebooks
- Preserves subdirectories

### Import with Overwrite

```bash
# Overwrite existing notebook
databricks workspace import ./notebook.py /Users/user@example.com/Notebook --overwrite
```

## Deleting Items

### Delete Notebook or File

```bash
databricks workspace delete /Users/user@example.com/Notebook
```

### Delete Empty Directory

```bash
databricks workspace delete /Users/user@example.com/EmptyFolder
```

**Note**: Directory must be empty to delete.

### Delete Directory and Contents

```bash
# Delete non-empty directory
databricks workspace delete /Users/user@example.com/Project --recursive
```

**Warning**: `--recursive` is irreversible. Confirm contents before deletion.

## Working with Libraries

### List Libraries

```bash
# List workspace libraries
databricks workspace list /Workspace/Shared

# List cluster libraries (via CLI)
databricks clusters cluster-libraries --cluster-id 1234-567890-abcde
```

### Install Library

Libraries are installed at cluster level, not workspace level.

```bash
# Install library to cluster
databricks libraries install --cluster-id 1234-567890-abcde --pypi-package pandas
```

## Repos Integration

### List Repos

```bash
databricks repos list
```

### Create Repo

```bash
# Create repo from Git URL
databricks repos create --url https://github.com/user/repo.git --path /Repos/my-repo
```

### Update Repo

```bash
# Pull latest changes
databricks repos update --repo-id 123456789
```

### Delete Repo

```bash
databricks repos delete --repo-id 123456789
```

## Common Workflows

### Backup Notebooks to Git

```bash
# Export to local directory
databricks workspace export-dir /Users/user@example.com ./backup

# Add to Git
cd backup
git add .
git commit -m "Backup notebooks"
git push
```

### Sync Local Directory to Workspace

```bash
# Import local changes
databricks workspace import-dir ./local-notebooks /Users/user@example.com
```

### Migrate Notebooks Between Workspaces

```bash
# Export from source workspace
databricks --profile source workspace export_dir /Users/user@example.com ./backup

# Import to target workspace
databricks --profile target workspace import_dir ./backup /Users/user@example.com
```

## Best Practices

### Organization

- Use meaningful directory structures
- Group related notebooks in folders
- Use Shared/ for team collaboration
- Use Repos/ for version-controlled code

### Version Control

- Export notebooks regularly for backup
- Use Git repos for production code
- Commit notebooks with documentation
- Use .gitignore for generated files

### Collaboration

- Share notebooks via Shared/ folder
- Use repos for collaborative development
- Document notebook dependencies
- Use relative paths within workspace

### Security

- Don't store credentials in notebooks
- Use secret management (dbutils.secrets)
- Limit workspace access permissions
- Audit notebook access regularly

## Troubleshooting

### Import Fails

**Common issues:**
- Invalid file format
- Language mismatch
- Path doesn't exist

**Solutions:**
```bash
# Verify file exists
ls -la ./notebook.py

# Check language
file notebook.py

# Create target directory if needed
databricks workspace mkdirs /Users/user@example.com/TargetFolder
```

### Export Fails

**Common issues:**
- Notebook not found
- Insufficient permissions
- Path too long

**Solutions:**
```bash
# List to verify path exists
databricks workspace list /Users/user@example.com

# Export to shorter path
databricks workspace export /Users/user@example.com/LongPath/Notebook ./notebook.py
```

### Delete Fails

**Common issues:**
- Directory not empty
- Insufficient permissions
- Notebook locked by running job

**Solutions:**
```bash
# Use recursive for non-empty directories
databricks workspace delete /path/to/folder --recursive

# Check for running jobs using the notebook
databricks jobs list-runs --active-only
```

## Additional Resources

### Reference Files

- **`references/paths.md`** - Workspace path conventions
- **`references/formats.md`** - Notebook format details
- **`references/permissions.md`** - Access control guide

### Example Files

- **`examples/export-script.sh`** - Automated backup script
- **`examples/sync-script.sh`** - Workspace sync script
- **`examples/migration-script.sh`** - Cross-workspace migration

### Scripts

- **`scripts/backup-workspace.sh`** - Backup entire workspace
- **`scripts/list-large-notebooks.sh`** - Find notebooks by size
