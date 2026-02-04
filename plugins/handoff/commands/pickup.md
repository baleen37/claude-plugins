---
name: pickup
description: Load a handoff session to restore context from a previous session
---

# /pickup - Load Handoff Session

Load a handoff file to restore session context from a previous session.

## Behavior

- **Default (no arguments)**: Load the most recent handoff for the current project
- **With UUID**: `/pickup {uuid}` - Load a specific handoff by ID

## What Gets Loaded

1. **Summary**: What was being worked on
2. **Next Steps**: Actionable next steps
3. **Decisions**: Key decisions made
4. **References**: Links to plans, tasks, and original session

## Implementation Steps

1. Determine handoff to load:
   - If UUID provided as argument: use that specific handoff
   - If no argument: find most recent handoff for current project
     - Scan `~/.claude/handoffs/*.json`
     - Filter by `project_path` matching `$CLAUDE_PROJECT_DIR`
     - Sort by `created_at` descending, pick first

1. Read and validate handoff file:

```bash
HANDOFF_FILE="$HOME/.claude/handoffs/$UUID.json"
if [ ! -f "$HANDOFF_FILE" ]; then
  echo "Handoff not found: $UUID"
  exit 1
fi
```

1. Display handoff information in a clear format

1. Update `loaded_at` timestamp:

```bash
jq --arg ts "$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
   '.loaded_at = $ts' "$HANDOFF_FILE" > "$HANDOFF_FILE.tmp"
mv "$HANDOFF_FILE.tmp" "$HANDOFF_FILE"
```

## Tools to Use

- `Bash` for file operations, jq for JSON manipulation
- `Read` for reading handoff files
- `Glob` for finding handoff files

## Example Output

```text
Session restored from handoff

ID: 550e8400-e29b-41d4-a716-446655440000
Created: 2026-02-04 16:30:00 UTC

Project: claude-plugins (feat/create-handoff)

Summary:
Implementing handoff plugin for session context transfer between
Claude Code sessions. Enables pausing work and resuming later or
handing off to team members.

Next Steps:
  - Complete /pickup command implementation
  - Add SessionStart hook for recent handoff notification
  - Write tests for all commands

Decisions:
  - Use single JSON file per handoff (UUID naming)
  - Reference-based storage (plan_path, tasks_session_id)
  - Same-project handoffs only

References:
  Plan: ~/.claude/plans/wiggly-growing-brook.md
  Tasks Session: 75c272b1-b00d-4bbb-bfa5-87269f30ff47
  Source Session: 00538c2c-c67e-4afe-a933-bb8ed6ed19c6
```

## Error Handling

- Handoff not found: Show error with available handoffs for current project
- Invalid JSON: Show parsing error
- Different project: Warn that handoff is from a different project
