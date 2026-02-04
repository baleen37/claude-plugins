# Handoff Plugin

Session handoff plugin for Claude Code - save and restore session context between sessions.

## Overview

The Handoff plugin enables you to:

- **Pause and resume work**: Save your current session state and pick up where you left off later
- **Context sharing**: Hand off work context to team members on the same project

## Features

- **/handoff**: Save current session context to a handoff file
- **/pickup**: Load a handoff (default: most recent, or specify UUID)
- **/handoff-list**: List all handoffs for the current project
- **Automatic notification**: SessionStart hook notifies you of recent handoffs (within 5 minutes)

## Installation

The plugin is automatically discovered when placed in the `plugins/` directory.

## Usage

### Creating a Handoff

```bash
/handoff
```

This analyzes your current session and creates a handoff file with:

- Session summary
- Next steps
- Key decisions
- References (plans, tasks, session IDs)

### Loading a Handoff

```bash
# Load most recent handoff for current project
/pickup

# Load specific handoff
/pickup 550e8400-e29b-41d4-a716-446655440000
```

### Listing Handoffs

```bash
/handoff-list
```

Shows all handoffs for the current project, sorted by creation date.

## Handoff Data Structure

Handoff files are stored as JSON in `~/.claude/handoffs/{UUID}.json`:

```json
{
  "id": "uuid-v4",
  "created_at": "2026-02-04T16:30:00Z",
  "loaded_at": null,
  "project_name": "claude-plugins",
  "project_path": "/Users/jito.hello/dev/wooto/claude-plugins",
  "branch": "feat/create-handoff",
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

## Constraints

- **Project-specific**: Handoffs are filtered by project path
- **Reference-based**: References to plans/tasks/sessions are stored, not content
- **UUID-based**: Each handoff has a unique UUID for identification

## SessionStart Hook

When you start a new session, the plugin checks for:

- Handoffs created within the last 5 minutes
- Handoffs that haven't been loaded yet
- Handoffs for the current project

If found, you'll see a notification:

```text
Handoff: Recent handoff found. Use /pickup to resume: [summary]
```

## Examples

### Workflow 1: Pause and Resume

```bash
# End of day - save current work
/handoff
# Output: Handoff saved with ID: 550e8400-e29b-41d4-a716-446655440000

# Next day - resume work
/pickup
# Output: Session restored with summary, next steps, and decisions
```

### Workflow 2: Team Handoff

```bash
# Developer A finishes their work
/handoff
# Output: Handoff saved with ID: 550e8400-e29b-41d4-a716-446655440000

# Developer B picks up the work
/handoff-list  # See available handoffs
/pickup 550e8400-e29b-41d4-a716-446655440000  # Load specific handoff
```

## Testing

Run the test suite:

```bash
bats tests/handoff/handoff.bats
```

## Requirements

- `jq` for JSON processing
- `uuidgen` for UUID generation (or use alternative)
- Bash shell

## License

MIT
