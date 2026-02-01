<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# auto-compact

## Purpose
Automatically suggests when to manually compact context during long sessions to prevent token bloat and maintain performance.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Plugin documentation |
| `.claude-plugin/plugin.json` | Plugin manifest |
| `hooks/hooks.json` | Hook configuration |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `hooks/` | Session hooks for context monitoring |
| `skills/strategic-compact/` | Strategic compaction skill |
| `tests/` | Plugin tests |

## For AI Agents

### Working In This Directory
- Monitors session context length
- Suggests `/compact` when context grows large
- Hooks run on SessionStart and SessionStop
- Uses strategic thresholds for suggestions

### Testing Requirements
- Test hook activation conditions
- Verify suggestion timing
- Ensure hook doesn't interfere with normal operation

### Common Patterns
- Session hooks use JSON configuration
- Skill provides user-facing guidance
- Thresholds are configurable

## Dependencies

### Internal
- `skills/strategic-compact/SKILL.md` - Compaction guidance

<!-- MANUAL: -->
