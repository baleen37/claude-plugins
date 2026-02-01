<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# plugins

## Purpose
Plugin collection - each subdirectory contains a self-contained plugin with its own commands, agents, skills, hooks, and tests.

## Key Plugins

| Plugin | Description |
|--------|-------------|
| `auto-compact/` | Automatic context compaction suggestions for long sessions |
| `auto-updater/` | Automatic plugin installation and updates from marketplace |
| `databricks/` | Databricks integration via MCP server |
| `git-guard/` | Git workflow protection hooks |
| `jira/` | Jira integration via Atlassian MCP server |
| `lsp-support/` | Language Server Protocol support for multiple languages |
| `me/` | Personal Claude Code configuration (TDD, debugging, git, code review) |
| `memory-persistence/` | Automatic session memory persistence |
| `ralph-loop/` | Continuous self-referential AI loops |

## Subdirectories

Each plugin directory may contain:
- `commands/` - Slash commands
- `agents/` - Autonomous agents
- `skills/` - Context-aware guides
- `hooks/` - Event hooks
- `scripts/` - Utility scripts
- `tests/` - Plugin-specific tests
- `.claude-plugin/` - Plugin metadata

## For AI Agents

### Working In This Directory
- Each plugin is self-contained
- All plugins have `.claude-plugin/plugin.json`
- Plugin discovery is automatic via `.releaserc.js`
- Reference `CLAUDE.md` for development guidelines

### Testing Requirements
- Run `bats tests/` for general tests
- Run plugin-specific tests in `{plugin}/tests/`
- Validate against schemas in `schemas/`

### Common Patterns
- Plugin names use `lowercase-with-hyphens` convention
- Use `${CLAUDE_PLUGIN_ROOT}` for portable paths
- Hook scripts use `set -euo pipefail`
- All components follow their respective schemas

## Dependencies

### Internal
- `schemas/` - JSON schemas for validation
- `tests/helpers/` - Shared test utilities

<!-- MANUAL: -->
