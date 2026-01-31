# Memory Persistence Plugin

Automatic session memory persistence for Claude Code.

## What It Does

This plugin automatically:
1. **Saves session context** when a Claude Code session ends
2. **Restores relevant context** when a new session starts

No manual commands required - it works automatically in the background.

## Installation

The plugin is included in the baleen-plugins marketplace. To install:

```bash
# Via auto-updater plugin (recommended)
/oh-my-claudecode:update-all-plugins

# Or manually update
cd ~/.claude/plugins/baleen-plugins
git pull
```

## How It Works

### Stop Hook (Session End)

When you close a Claude Code session, the plugin:
- Receives Stop hook input with `session_id` and `transcript_path`
- Extracts the last assistant message from the transcript (JSONL format)
- Saves it to `~/.claude/sessions/session-{session_id}-{timestamp}.md`
- Exits silently (does not block session exit)

### SessionStart Hook (Session Start)

When you start a new Claude Code session, the plugin:
- Finds up to 5 recent session files (sorted by modification time)
- Displays their context to Claude
- Helps Claude maintain continuity across sessions

## Storage Locations

- **Sessions**: `~/.claude/sessions/`
- **Learned Skills**: `~/.claude/skills/learned/` (future feature)

## Session File Format

```markdown
# Session: abc123def456
# Date: 2026-01-31 12:34:56

## Last Assistant Message

[Last assistant message from transcript...]

## Session Metadata

- Session ID: abc123def456
- End Time: 2026-01-31 12:34:56
- Transcript: /path/to/transcript.jsonl
- Saved by: memory-persistence plugin
```

## Configuration

No configuration required. The plugin works out of the box.

Environment variables (optional):
- `MEMORY_PERSISTENCE_SESSIONS_DIR`: Override sessions directory (default: `~/.claude/sessions/`)

## Troubleshooting

**Sessions not being saved?**
- Check that hooks are properly installed: `ls ~/.claude/plugins/baleen-plugins/plugins/memory-persistence/hooks/`
- Verify scripts are executable: `chmod +x ~/.claude/plugins/baleen-plugins/plugins/memory-persistence/hooks/*.sh`

**Context not being restored?**
- Check that session files exist: `ls ~/.claude/sessions/`
- Verify SessionStart hook is running (should see "Restored Context" message)

## License

MIT License - See repository for details.
