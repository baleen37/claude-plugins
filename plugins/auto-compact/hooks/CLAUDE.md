<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# hooks

## Purpose
Session hooks for automatic context compaction suggestions.

## Key Files

| File | Description |
|------|-------------|
| `hooks.json` | Hook configuration |
| `session-start-hook.sh` | Initialize compaction monitoring |
| `session-stop-hook.sh` | Suggest compaction if context is large |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `lib/` | Shared libraries |

## For AI Agents

### Working In This Directory
- Monitors session context length
- Suggests `/compact` when context grows large
- Uses strategic thresholds for suggestions
- Non-blocking (suggestions only)

### Testing Requirements
- Test hook activation conditions
- Verify suggestion timing
- Ensure hook doesn't interfere with normal operation

### Common Patterns
- `set -euo pipefail` for error detection
- Session ID from environment
- Thresholds configurable

## Dependencies

### Internal
- `../skills/strategic-compact/` - Compaction guidance

<!-- MANUAL: -->
