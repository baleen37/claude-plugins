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

## Quick Start

### Run the Interactive Demo

```bash
# Run all workspace operations demo
cd examples
./quick-start.sh

# Use specific profile
DATABRICKS_PROFILE=prod ./quick-start.sh
```

The `quick-start.sh` script demonstrates:
- Listing workspace items
- Uploading and importing code
- Quick code execution
- Git repo operations
- Exporting workspace items

### Quick Code Execution

```bash
# Run Python code instantly
cd examples
./run-simple.sh 'print("Hello World"); spark.range(10).count()'

# Run with specific cluster
CLUSTER_ID=0210-030934-hwk19fl0 ./run-simple.sh 'df = spark.range(100); df.show()'
```

## Workspace Structure

### Default Layout

```
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

## Common Operations

### Listing Workspace Items

```bash
# List root directory
databricks workspace list /

# List subdirectory
databricks workspace list /Users/user@example.com

# List with JSON output
databricks workspace list /Users/user@example.com --output json

# List all items recursively
databricks workspace list / --recursive
```

**JSON Output includes:**
- Object type (Directory, Notebook)
- Last modified timestamp
- File size (for objects)
- Object ID
- Language (for notebooks)

### Creating Directories

```bash
# Create directory (creates parents if needed)
databricks workspace mkdirs /Users/user@example.com/Project

# Create nested directory
databricks workspace mkdirs /Users/user@example.com/Project/Subdirectory/Data
```

### Importing Notebooks

```bash
# Import Python notebook
databricks workspace import ./notebook.py /Users/user@example.com/Notebook

# Import to specific location
databricks workspace import ./notebook.py /Users/user@example.com/Project/Notebook

# Specify language explicitly
databricks workspace import ./notebook.py /Users/user@example.com/Notebook --language PYTHON

# Overwrite existing notebook
databricks workspace import ./notebook.py /Users/user@example.com/Notebook --overwrite
```

**Supported languages:**
- `PYTHON` - Python notebook
- `SCALA` - Scala notebook
- `R` - R notebook
- `SQL` - SQL notebook
- `DATABRICKS-SCALA` - Databricks Scala

### Exporting Notebooks

```bash
# Export notebook to current directory
databricks workspace export /Users/user@example.com/Notebook ./notebook.py

# Export to specific location
databricks workspace export /Users/user@example.com/Notebook /path/to/output.py

# Export directory and contents
databricks workspace export-dir /Users/user@example.com/Project ./local-project

# Export all user notebooks (backup)
databricks workspace export-dir /Users/user@example.com ./backup-$(date +%Y%m%d)
```

**Export Formats:**
- `.py` - Python source code
- `.scala` - Scala source code
- `.r` - R source code
- `.sql` - SQL source code
- `.html` - HTML file with input/output cells

**Databricks CLI auto-detects language by extension.**

### Deleting Items

```bash
# Delete notebook or file
databricks workspace delete /Users/user@example.com/Notebook

# Delete directory (must be empty)
databricks workspace delete /Users/user@example.com/EmptyFolder

# Delete non-empty directory (irreversible!)
databricks workspace delete /Users/user@example.com/Project --recursive
```

## Git Repos Operations

### Listing Repos

```bash
# List all repos
databricks repos list

# List with JSON output
databricks repos list --output json

# List /Repos directory contents
databricks workspace list /Repos
```

### Managing Repos

```bash
# Create repo from Git URL
databricks repos create --url https://github.com/user/repo.git --path /Repos/my-repo

# Pull latest changes
databricks repos update --repo-id 123456789

# Delete repo
databricks repos delete --repo-id 123456789
```

## Running Notebooks

### Using Jobs API

```bash
# Submit notebook execution job
databricks jobs submit --json '{
  "run_name": "My Job",
  "tasks": [{
    "task_key": "my_task",
    "notebook_task": {
      "notebook_path": "/Users/user@example.com/Notebook"
    },
    "existing_cluster_id": "0210-030934-hwk19fl0"
  }]
}'

# Get job run output
databricks jobs get-run-output <run-id> --output json
```

### Quick Execution Script

Use the `run-simple.sh` script for instant code execution:

```bash
cd examples
./run-simple.sh 'print("Quick test"); spark.range(10).count()'
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

### Example Scripts

- **`examples/quick-start.sh`** - Comprehensive workspace operations demo
- **`examples/run-simple.sh`** - Quick code execution tool

### Reference Documentation

- **`references/paths.md`** - Workspace path conventions
- **`references/formats.md`** - Notebook format details
- **`references/permissions.md`** - Access control guide
