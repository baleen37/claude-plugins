<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# auto-updater

## Purpose
Automatic plugin installation and updates from baleen-plugins marketplace. Keeps plugins synchronized with the remote marketplace.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Plugin documentation |
| `config.json` | Marketplace configuration |
| `.claude-plugin/plugin.json` | Plugin manifest |
| `commands/update-all-plugins.md` | Update command |
| `hooks/hooks.json` | SessionStart hook for auto-update |
| `scripts/update.sh` | Update script |
| `scripts/lib/` | Utility libraries |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `commands/` | Update command |
| `hooks/` | SessionStart auto-update hook |
| `scripts/` | Update scripts and utilities |
| `scripts/lib/` | Shared libraries |
| `tests/` | Update tests and fixtures |

## For AI Agents

### Working In This Directory
- Checks marketplace for updates on session start
- Updates plugins from configured marketplace URL
- Supports `--silent` mode for non-interactive updates
- Validates marketplace.json structure

### Testing Requirements
- Test update logic with various marketplace states
- Verify silent mode functionality
- Test with invalid marketplace URLs
- Ensure rollback on failure

### Common Patterns
- Use `CLAUDE_PLUGIN_ROOT` for portability
- Hook script uses `set -euo pipefail`
- JSON parsing with jq
- Atomic updates (download to temp, then move)

## Dependencies

### External
- **curl** - Downloading marketplace data
- **jq** - JSON parsing

### Internal
- `tests/helpers/` - Shared test utilities
- `schemas/marketplace-schema.json` - Validation

<!-- MANUAL: -->
