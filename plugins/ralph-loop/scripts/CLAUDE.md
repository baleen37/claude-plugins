<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# scripts

## Purpose
Ralph Loop setup and control scripts - state management and session tracking.

## Key Files

| File | Description |
|------|-------------|
| `lib/common.sh` | Shared utility functions |
| `lib/state.sh` | State file management |
| `setup-ralph-loop.sh` | Initialize Ralph Loop state |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `lib/` | Shared libraries |

## For AI Agents

### Working In This Directory
- Shell scripts use `set -euo pipefail`
- State files use `.local.md` extension
- Portable paths via `${CLAUDE_PLUGIN_ROOT}`
- Manages iteration counting and completion

### Testing Requirements
- Test state file creation
- Verify iteration counting
- Test completion detection
- Ensure state cleanup

### Common Patterns
- Error messages to stderr
- State in `~/.claude/ralph-loop/`
- JSON parsing with jq (if needed)

## Dependencies

### External
- None (self-contained)

### Internal
- `../hooks/` - Hooks that use these scripts
- `../commands/` - Commands that invoke setup

<!-- MANUAL: -->
