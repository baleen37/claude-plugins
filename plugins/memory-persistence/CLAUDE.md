<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# memory-persistence

## Purpose
Automatic session memory persistence - saves context at session end and restores relevant context at session start.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Plugin documentation |
| `.claude-plugin/plugin.json` | Plugin manifest |
| `hooks/hooks.json` | Hook configuration |
| `scripts/lib/` | Utility libraries |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `hooks/` | SessionStart/SessionStop hooks |
| `scripts/` | Persistence scripts |
| `scripts/lib/` | Shared libraries |

## For AI Agents

### Working In This Directory
- SessionStop hook saves conversation transcript
- SessionStart hook searches and restores relevant context
- Uses semantic search for context retrieval
- Stores sessions in `~/.claude/projects/`

### Testing Requirements
- Test session saving on stop
- Test context restoration on start
- Verify semantic search accuracy
- Test with various session types

### Common Patterns
- Hook scripts use `set -euo pipefail`
- Use `${CLAUDE_PLUGIN_ROOT}` for portability
- JSON parsing with jq
- Session ID from environment

## Dependencies

### External
- **mcp__plugin_episodic-memory** - Memory persistence MCP server

### Internal
- `tests/memory-persistence.bats` - Plugin tests

<!-- MANUAL: -->
