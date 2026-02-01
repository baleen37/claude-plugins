<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# scripts

## Purpose
Memory persistence utility scripts and shared libraries.

## Key Files

| File | Description |
|------|-------------|
| `lib/common.sh` | Shared utility functions |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `lib/` | Shared libraries |

## For AI Agents

### Working In This Directory
- Shell scripts use `set -euo pipefail`
- Portable paths via `${CLAUDE_PLUGIN_ROOT}`
- Utilities for session management

### Testing Requirements
- Test utility functions
- Verify error handling
- Ensure portability

### Common Patterns
- Error messages to stderr
- Use local variables
- Export functions for use in hooks

## Dependencies

### External
- **mcp__plugin_episodic-memory** - Memory MCP server

### Internal
- `../hooks/` - Hooks that use these scripts

<!-- MANUAL: -->
