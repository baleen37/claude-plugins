<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# commands

## Purpose
Slash commands for personal Claude Code workflow automation - TDD, debugging, git, code review, and development workflows.

## Key Files

| File | Description |
|------|-------------|
| `brainstorm.md` | Creative exploration before implementation |
| `create-pr.md` | Complete git workflow (commit → push → PR) |
| `debug.md` | Systematic debugging methodology |
| `orchestrate.md` | Sequential agent workflows |
| `refactor-clean.md` | Refactoring with cleanup |
| `research.md` | Exploration and investigation mode |
| `sdd.md` | Subagent-driven development execution |
| `verify.md` | Comprehensive verification before completion |
| `claude-isolated-test.md` | Docker containerized Claude testing |

## Subdirectories

None

## For AI Agents

### Working In This Directory
- Commands use YAML frontmatter for metadata
- Format: `---\ntitle: ...\ndescription: ...\n---\n`
- Commands are invoked with `/command-name`
- Each command provides specific workflow guidance

### Testing Requirements
- Verify command metadata is valid
- Test command invocation
- Ensure command content is actionable

### Common Patterns
- YAML frontmatter separated by `---`
- Title and description fields required
- Command body contains instructions for Claude

## Dependencies

### Internal
- `../skills/` - Related skills for command workflows
- `../agents/` - Agents used by commands

<!-- MANUAL: -->
