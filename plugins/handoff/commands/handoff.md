---
name: handoff
description: Save current session context to a handoff file for later restoration
---

# /handoff - Save Session Context

Save the current session context to a handoff file that can be restored later using `/pickup`.

## Behavior

1. Analyze recent conversation to create a summary
2. Extract next steps and key decisions
3. Collect reference information (plan_path, tasks_session_id)
4. Generate a UUID and save as JSON file
5. Display the handoff ID for later reference

## Handoff File Location

`~/.claude/handoffs/{UUID}.json`

## Data Structure

```json
{
  "id": "uuid-v4",
  "created_at": "2026-02-04T16:30:00Z",
  "loaded_at": null,
  "project_name": "project-name",
  "project_path": "/absolute/path/to/project",
  "branch": "feature-branch",
  "summary": "Brief summary of current work",
  "next_steps": ["Step 1", "Step 2"],
  "decisions": ["Decision 1", "Decision 2"],
  "references": {
    "plan_path": "~/.claude/plans/plan-name.md",
    "tasks_session_id": "session-uuid",
    "session_id": "current-session-uuid"
  },
  "source_session_id": "current-session-uuid"
}
```

## Implementation Steps

1. Get current project information:
   - Project name from directory name or git config
   - Project path from `$CLAUDE_PROJECT_DIR`
   - Current branch from `git branch --show-current`

1. Get session references:
   - Check for active plan: look for recent `.md` files in `~/.claude/plans/`
   - Check for active tasks: look for `~/.claude/tasks/*/state.json`
   - Get current session ID from environment or transcript

1. Analyze conversation:
   - Read recent conversation context
   - Generate a concise summary (2-3 sentences)
   - Extract next steps from TODOs or explicit next actions
   - Extract key decisions made

1. Generate UUID and create handoff directory:

```bash
HANDOFF_DIR="$HOME/.claude/handoffs"
mkdir -p "$HANDOFF_DIR"
UUID=$(uuidgen)
```

1. Write handoff file and display ID:

```bash
echo "Handoff saved with ID: $UUID"
echo "Use /pickup $UUID to restore this session"
```

## Tools to Use

- `Bash` for git commands, file operations, UUID generation
- `Read` for reading plan files, task state files
- `Glob` for finding recent plan/task files

## Example Output

```text
Handoff saved successfully!

ID: 550e8400-e29b-41d4-a716-446655440000
Project: claude-plugins (feat/create-handoff)
Summary: Implementing handoff plugin for session context transfer

Next Steps:
  - Complete /pickup command implementation
  - Add SessionStart hook for recent handoff notification

Use /pickup to restore this session, or /pickup {uuid} for a specific handoff.
```
