<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# hooks

## Purpose
Session hooks for automatic memory persistence - save on stop, restore on start.

## Key Files

| File | Description |
|------|-------------|
| `hooks.json` | Hook configuration |
| `session-start-hook.sh` | Restore relevant context from previous sessions |
| `session-stop-hook.sh` | Save conversation transcript to memory |

## Subdirectories

None

## For AI Agents

### Working In This Directory
- SessionStop saves conversation to memory
- SessionStart searches and restores relevant context
- Uses episodic-memory MCP server
- Sessions stored in `~/.claude/projects/`

### Testing Requirements
- Test session saving on stop
- Test context restoration on start
- Verify semantic search accuracy
- Test with various session types

### Common Patterns
- `set -euo pipefail` for error detection
- Session ID from `${CLAUDE_SESSION_ID}`
- Use MCP tools for memory operations
- Non-blocking (failure shouldn't prevent session)

## Dependencies

### External
- **mcp__plugin_episodic-memory** - Memory persistence MCP server

### Internal
- `../scripts/` - Related scripts
- `../../tests/memory-persistence.bats` - Tests

<!-- MANUAL: -->
