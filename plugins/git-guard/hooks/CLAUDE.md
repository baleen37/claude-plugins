<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# hooks

## Purpose
Git workflow protection hooks - prevent commit/PR bypasses and enforce pre-commit checks.

## Key Files

| File | Description |
|------|-------------|
| `hooks.json` | Hook configuration |
| `session-start-hook.sh` | Replace git hooks on session start |
| `pre-commit-hook.sh` | Block --no-verify bypass |
| `pre-push-hook.sh` | Block push without PR (optional) |
| `lib/common.sh` | Shared utilities |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `lib/` | Shared libraries |

## For AI Agents

### Working In This Directory
- SessionStart backs up and replaces git hooks
- Pre-commit checks pre-commit status before allowing commit
- Pre-push validates PR existence (optional)
- Hooks are chainable

### Testing Requirements
- Test hook installation and removal
- Verify --no-verify is blocked
- Test pre-push PR validation
- Ensure existing hooks are backed up

### Common Patterns
- `set -euo pipefail` for error detection
- `git rev-parse --git-dir` for .git path
- Exit non-zero to block operation
- Backup hooks with `.backup` suffix

## Dependencies

### External
- **pre-commit** - Python-based pre-commit framework
- **git** - Version control

### Internal
- `../../tests/git-guard-hooks.bats` - Hook tests

<!-- MANUAL: -->
