<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# skills

## Purpose
Standalone skills that are not part of any specific plugin. These are general-purpose skills for Claude Code.

## Key Files

| File | Description |
|------|-------------|
| `.gitkeep` | Placeholder to ensure directory is tracked |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `tmux-testing/` | Tmux-based testing utilities for interactive CLI testing |

## For AI Agents

### Working In This Directory
- Standalone skills follow the same structure as plugin skills
- Each skill has its own directory with `SKILL.md`
- Skills here are globally available without plugin dependency

### Testing Requirements
- Test skill activation conditions
- Verify skill content is clear and actionable
- Ensure skills don't conflict with plugin skills

### Common Patterns
- `SKILL.md` contains the skill definition
- Use descriptive skill names
- Include clear trigger conditions

## Dependencies

### Internal
- `plugins/*/skills/` - Plugin skills for reference

<!-- MANUAL: -->
