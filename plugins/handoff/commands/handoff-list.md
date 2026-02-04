---
name: handoff-list
description: List all handoffs for the current project
---

# /handoff-list - List Project Handoffs

List all handoff files for the current project, showing ID, date, and summary.

## Behavior

1. Scan `~/.claude/handoffs/` directory for JSON files
2. Filter handoffs by `project_path` matching current project
3. Sort by `created_at` descending (newest first)
4. Display in a readable table format

## Display Format

```text
Handoffs for: claude-plugins (/Users/jito.hello/dev/wooto/claude-plugins)

ID                                  Created              Summary
----------------------------------- ------------------- ----------------------------------
550e8400-e29b-41d4-a716-446655440000 2026-02-04 16:30    Implementing handoff plugin
440e8300-d19a-30c3-b615-335544339999 2026-02-03 10:15    Working on create-pr feature
330e7200-c189-20b2-a514-224433228888 2026-02-02 14:00    Fixing CI pipeline issues

3 handoffs found
Use /pickup {uuid} to restore a specific handoff
```

## Implementation Steps

1. Get current project path from `$CLAUDE_PROJECT_DIR`

1. Find and filter handoff files:

```bash
HANDOFF_DIR="$HOME/.claude/handoffs"
PROJECT_PATH="$CLAUDE_PROJECT_DIR"

for file in "$HANDOFF_DIR"/*.json; do
  project_path=$(jq -r '.project_path' "$file")
  if [ "$project_path" = "$PROJECT_PATH" ]; then
    # Include in list
  fi
done
```

1. Sort by created_at descending:

```bash
jq -s 'sort_by(.created_at) | reverse' filtered_handoffs.json
```

1. Format output with aligned columns

## Tools to Use

- `Bash` for file operations and formatting
- `Read` for reading handoff files
- `Glob` for finding handoff files

## Empty State

```text
No handoffs found for: claude-plugins

Use /handoff to create a handoff for this session.
```

## Error Handling

- Handoffs directory doesn't exist: Show "No handoffs found" message
- Invalid JSON files: Skip with warning
- Handoffs from different projects: Filter out silently
