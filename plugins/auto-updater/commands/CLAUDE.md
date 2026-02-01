<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# commands

## Purpose
Auto-updater slash command - manually trigger plugin updates.

## Key Files

| File | Description |
|------|-------------|
| `update-all-plugins.md` | Trigger plugin update from marketplace |

## Subdirectories

None

## For AI Agents

### Working In This Directory
- Command invokes update script
- Supports silent mode
- Updates all plugins from marketplace

### Testing Requirements
- Test update invocation
- Verify silent mode works
- Test with invalid marketplace

## Dependencies

### Internal
- `../scripts/update.sh` - Update script

<!-- MANUAL: -->
