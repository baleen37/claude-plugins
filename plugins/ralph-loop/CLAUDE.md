<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# ralph-loop

## Purpose
Continuous self-referential AI loops for interactive iterative development, implementing the Ralph Wiggum technique.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Plugin documentation |
| `.claude-plugin/plugin.json` | Plugin manifest |
| `hooks/hooks.json` | Hook configuration |
| `scripts/lib/` | Utility libraries |

## Commands

| Command | Purpose |
|---------|---------|
| `ralph-loop.md` | Start Ralph Loop with prompt and iteration count |
| `cancel-ralph.md` | Cancel active Ralph Loop |
| `help.md` | Display Ralph Loop help |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `commands/` | Ralph Loop commands |
| `hooks/` | SessionStart/SessionStop hooks |
| `scripts/` | Setup and control scripts |
| `scripts/lib/` | Shared libraries |
| `tests/` | Plugin tests |

## For AI Agents

### Working In This Directory
- Stop hook intercepts session termination
- Feeds last assistant output as next prompt
- Uses state files in `~/.claude/ralph-loop/`
- Supports completion promises (`<promise>TAG</promise>`)

### Testing Requirements
- Test loop iteration mechanics
- Verify completion detection
- Test cancellation functionality
- Ensure state cleanup on completion

### Common Patterns
- Hook scripts use `set -euo pipefail`
- State files use `.local.md` extension
- Session ID in environment
- Maximum iterations configurable

## Dependencies

### Internal
- `tests/ralph-loop/` - Plugin tests (if exists)

### External
- None (self-contained)

<!-- MANUAL: -->
