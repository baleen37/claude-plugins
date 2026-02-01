<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# scripts

## Purpose
Update scripts and utility libraries for automatic plugin updates from marketplace.

## Key Files

| File | Description |
|------|-------------|
| `update.sh` | Main update script - downloads and installs plugins |
| `check.sh` | Check script - validates marketplace and plugin status |
| `lib/common.sh` | Shared utility functions |
| `lib/json.sh` | JSON parsing utilities |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `lib/` | Shared libraries |

## For AI Agents

### Working In This Directory
- Shell scripts use `set -euo pipefail`
- Portable paths via `${CLAUDE_PLUGIN_ROOT}`
- JSON parsing with jq
- Atomic updates (temp → final)

### Testing Requirements
- Test update with valid marketplace
- Test with invalid/malformed marketplace
- Verify rollback on failure
- Test silent mode functionality

### Common Patterns
- Error messages to stderr (`>&2`)
- Exit 0 on success, non-zero on failure
- Use jq for JSON operations
- Temporary files for atomic updates

## Dependencies

### External
- **curl** - Download marketplace data
- **jq** - JSON parsing

### Internal
- `../../tests/fixtures/` - Test fixtures
- `../../../schemas/marketplace-schema.json` - Validation

<!-- MANUAL: -->
