# Notebook Format Details

## Databricks Notebook Format

### Source Code Format (`.py`, `.scala`, `.r`, `.sql`)

Databricks notebooks can be exported as plain source code files:

```python
# Databricks notebook source
# Command 1
print("Hello, World!")

# Command 2
df = spark.range(10)
df.show()
```

**Structure:**
- `# Databricks notebook source` header (required for import)
- Each cell starts with `# Command N` comment
- Cell content follows the comment
- Blank lines separate cells

**Import behavior:**
- CLI auto-detects language by file extension
- Each command becomes a separate cell
- Commands execute sequentially

### Import Language Mapping

| Extension | Language | CLI Flag |
|-----------|----------|----------|
| `.py` | PYTHON | `--language PYTHON` |
| `.scala` | SCALA | `--language SCALA` |
| `.r` | R | `--language R` |
| `.sql` | SQL | `--language SQL` |
| `.dbc` | Archive | Not applicable |

## Archive Format (`.dbc`)

The `.dbc` format is a JSON archive containing multiple notebooks:

```json
{
  "version": "NotebookV1",
  "resources": [],
  "commands": [
    {
      "command": "print(\"Hello\")",
      "position": 0.0,
      "bindings": {},
      "outputCaptured": true
    }
  ],
  "originalName": "Notebook",
  "language": "python",
  "dashboardViews": {}
}
```

**Use cases:**
- Multi-notebook exports
- Workspace backups
- Preserves cell outputs and metadata
- Platform-specific (not easily editable)

## HTML Export Format

```bash
databricks workspace export /Users/user@example.com/Notebook notebook.html
```

**Contains:**
- Rendered HTML with input cells
- Cell output (if previously run)
- Styling and formatting
- Not suitable for re-import

## Workspace API Object Format

When listing workspace items, each object has this structure:

```json
{
  "object_type": "NOTEBOOK" | "DIRECTORY" | "LIBRARY" | "FILE",
  "path": "/Users/user@example.com/Notebook",
  "object_id": 123456789,
  "language": "PYTHON" | "SCALA" | "R" | "SQL",
  "last_modified": {
    "seconds": 1678901234
  }
}
```

### Object Types

| Type | Description |
|------|-------------|
| `NOTEBOOK` | Executable notebook |
| `DIRECTORY` | Folder containing items |
| `LIBRARY` | Uploaded library (jar, wheel, etc) |
| `FILE` | Non-executable file |

## Cell Format Details

### Command Structure

```
# Command N
[Cell content here]

# Command N+1
[More content]
```

**Rules:**
- Sequential numbering starting at 1
- Gaps in numbering are allowed
- Commands execute in numerical order
- Renumbering happens on import

### Special Commands

**Magic commands:**

```python
# %run /Users/user@example.com/OtherNotebook
# %fs ls /FileStore/
# %sql
# %md
# %sh pip install package
```

**Comments vs Commands:**

```python
# This is a comment within a command
print("Hello")

# Command 2
# This is a new cell starting with comment
```

## Import/Export Behavior

### Export Formats by Language

| Language | Source Extension | Archive Support |
|----------|------------------|-----------------|
| Python | `.py` | Yes |
| Scala | `.scala` | Yes |
| R | `.r` | Yes |
| SQL | `.sql` | Yes |

### Auto-Detection

```bash
# Language detected from .py extension
databricks workspace import notebook.py /Users/user@example.com/Notebook

# Explicit language (overrides extension)
databricks workspace import notebook.txt /Users/user@example.com/Notebook --language PYTHON
```

### Overwrite Behavior

```bash
# Fails if notebook exists
databricks workspace import notebook.py /Users/user@example.com/Notebook

# Overwrites existing notebook
databricks workspace import notebook.py /Users/user@example.com/Notebook --overwrite
```

## Format Conversion

### Python to/from IPython

Databricks format is similar but not identical to Jupyter:

```python
# Databricks
# Databricks notebook source
# Command 1
print("Hello")

# Jupyter
{
  "cells": [
    {
      "cell_type": "code",
      "source": ["print(\"Hello\")"]
    }
  ]
}
```

**No built-in conversion** - use export/import scripts.

## Best Practices

### Source Control

```bash
# Export as source for version control
databricks workspace export-dir /Users/user@example.com/project ./src

# .gitignore
*.dbc
*.html
```

### Header Consistency

Always include `# Databricks notebook source` as first line for proper imports.

### Cell Organization

- Keep cells focused on single tasks
- Use descriptive comments
- Avoid very long cells (>100 lines)
- Number sequentially when writing manually
