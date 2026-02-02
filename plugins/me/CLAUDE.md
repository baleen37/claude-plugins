<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# me

## Purpose
Personal Claude Code configuration - TDD enforcement, systematic debugging, git workflow automation, code review, and development automation.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Plugin documentation |
| `.claude-plugin/plugin.json` | Plugin manifest |
| `hooks/hooks.json` | Hook configuration |

## Commands

| Command | Purpose |
|---------|---------|
| `brainstorm.md` | Creative brainstorming before implementation |
| `create-pr.md` | Complete git workflow (commit → push → PR) |
| `debug.md` | Systematic debugging methodology |
| `orchestrate.md` | Sequential agent workflows |
| `refactor-clean.md` | Refactoring with cleanup |
| `research.md` | Research mode with evidence-based analysis |
| `verify.md` | Comprehensive verification before completion |

## Agents

| Agent | Purpose |
|-------|---------|
| `code-reviewer.md` | Code review specialist |
| `web-researcher.md` | Web research for documentation and best practices |

## Skills

| Skill | Purpose |
|-------|---------|
| `ci-troubleshooting/` | GitHub Actions CI debugging |
| `claude-isolated-test/` | Docker containerized testing |
| `research/` | Exploration and investigation |
| `using-git-worktrees/` | Git worktree management |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `commands/` | Slash commands |
| `agents/` | Autonomous agents |
| `skills/` | Context-aware skills |
| `hooks/` | Event hooks |
| `tests/` | Plugin tests |

## For AI Agents

### Working In This Directory
- Personal workflow automation plugin
- Commands follow specific patterns (TDD, debugging, git)
- Skills activate automatically based on context
- Agents provide specialized expertise

### Testing Requirements
- Test each command's workflow
- Verify skill activation conditions
- Test agent functionality
- Ensure hooks work correctly

### Common Patterns
- Commands use YAML frontmatter for metadata
- Skills have SKILL.md files
- Agents define model and tools
- Hooks use JSON configuration

## Dependencies

### Internal
- `tests/helpers/` - Shared test utilities
- `schemas/` - JSON schemas

<!-- MANUAL: -->
