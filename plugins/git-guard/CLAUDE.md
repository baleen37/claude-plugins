<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# git-guard

## Purpose
Git workflow protection hooks - prevents commit and PR bypasses, enforces pre-commit checks.

## Key Files

| File | Description |
|------|-------------|
| `.claude-plugin/plugin.json` | Plugin manifest |
| `hooks/hooks.json` | Hook configuration |
| `hooks/session-start-hook.sh` | Replaces git hooks on session start |
| `hooks/pre-commit-hook.sh` | Blocks --no-verify bypass |
| `hooks/pre-push-hook.sh` | Blocks push without PR (optional) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `hooks/` | Git hook scripts |
| `tests/` | Hook tests |

## For AI Agents

### Working In This Directory
- SessionStart hook replaces existing git hooks
- Pre-commit hook checks pre-commit status
- Pre-push hook validates PR existence
- Hooks are chainable (backs up existing hooks)

### Testing Requirements
- Test hook installation
- Verify --no-verify is blocked
- Test pre-push PR validation
- Ensure hooks work with existing git hooks

### Common Patterns
- Hook scripts use `set -euo pipefail`
- Backup existing hooks before replacing
- Use `git rev-parse --git-dir` for .git path
- Exit non-zero to block operation

## Dependencies

### External
- **pre-commit** - Python-based pre-commit framework
- **git** - Version control

### Internal
- `tests/git-guard-hooks.bats` - Hook tests

<!-- MANUAL: -->
