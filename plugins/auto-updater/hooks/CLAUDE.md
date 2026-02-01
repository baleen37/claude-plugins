<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# hooks

## Purpose
SessionStart hook for automatic plugin updates.

## Key Files

| File | Description |
|------|-------------|
| `hooks.json` | Hook configuration |
| `session-start-hook.sh` | Auto-update on session start |

## Subdirectories

None

## For AI Agents

### Working In This Directory
- Runs on SessionStart
- Checks marketplace for updates
- Updates plugins if newer versions available
- Silent mode (non-interactive)

### Testing Requirements
- Test auto-update on session start
- Verify marketplace checking
- Test update failure handling

### Common Patterns
- `set -euo pipefail`
- Uses update script from ../scripts/
- Non-blocking (failure shouldn't prevent session)

## Dependencies

### Internal
- `../scripts/update.sh` - Update script
- `../scripts/check.sh` - Version check script

<!-- MANUAL: -->
