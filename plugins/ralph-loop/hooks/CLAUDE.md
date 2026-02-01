<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# hooks

## Purpose
Session hooks for Ralph Loop - SessionStart setup and SessionStop looping mechanism.

## Key Files

| File | Description |
|------|-------------|
| `hooks.json` | Hook configuration |
| `session-start-hook.sh` | Initialize Ralph Loop state on session start |
| `session-env.sh` | Set environment variables for session tracking |
| `stop-hook.sh` | Intercept session stop and continue loop |

## Subdirectories

None

## For AI Agents

### Working In This Directory
- SessionStart creates state directory and files
- SessionStop is intercepted to continue iteration
- State files track iteration count and completion
- Completes when `<promise>TAG</promise>` detected or max iterations reached

### Testing Requirements
- Test session start initialization
- Verify stop hook interception
- Test completion detection
- Ensure state cleanup on completion

### Common Patterns
- `set -euo pipefail` for error detection
- State in `~/.claude/ralph-loop/`
- Session ID from `${CLAUDE_SESSION_ID}`
- Last assistant output fed as next prompt

## Dependencies

### External
- None (self-contained)

### Internal
- `../commands/` - Commands that start/control loop
- `../scripts/lib/` - Shared utilities

<!-- MANUAL: -->
