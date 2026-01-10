---
name: writing-claude-code
description: Use when creating Claude Code components (plugins, skills, agents, hooks) or writing CLAUDE.md files
---

# Writing Claude Code Components

## Overview

**Core Principle:** Progressive Disclosure - only universally applicable info in always-loaded contexts. Task-specific documentation belongs in separate files, not CLAUDE.md.

**Announce at start:** "I'm using the writing-claude-code skill to create/review Claude Code components."

## When to Use

**Use for:**
- Creating or reviewing CLAUDE.md files
- Writing new commands, skills, agents, or hooks
- Debugging component discovery or activation issues
- Reviewing component structure for best practices

**Don't use for:**
- Code style guidelines (use linters like Biome/prettier)
- Project-specific conventions (put in project CLAUDE.md)
- Simple one-off tasks (use commands)

## The Iron Law

```
CLAUDE.md > 300 lines? Separate into task-specific docs.
Command > 3 steps? Create a skill, not a command.
Skill without failing test? Delete and start with TDD.
```

## Quick Reference

| Component | Trigger | Key Rule |
|-----------|---------|----------|
| **CLAUDE.md** | Every session | <60 lines ideal, <300 max |
| **Commands** | Simple tasks | 5-20 lines, 1-3 steps |
| **Skills** | Complex workflows | 4+ steps, TDD required |
| **Agents** | Autonomous work | Dedicated tools |
| **Hooks** | Events | Automation |

## Critical Rules

**CLAUDE.md:** NO code style (use linters), NO task-specific (separate docs)

**Skills:** NO SKILL WITHOUT FAILING TEST FIRST. Description: "Use when..." + trigger ONLY

**Commands:** 4+ steps = skill, period. Steps count, not lines.

## Anti-Patterns

| Pattern | Fix |
|---------|-----|
| Code style in CLAUDE.md | Use Biome/prettier |
> 300 line CLAUDE.md | Progressive Disclosure
| 4+ step command | Create skill |
| Auto-generated CLAUDE.md | Manual curation |

## Progressive Disclosure

```markdown
# CLAUDE.md (minimal core)

## Task-Specific Docs
When working on specific tasks, read:
- `docs/building.md` - Build commands
- `docs/testing.md` - Test procedures
```

## Common Mistakes

1. **Context Bloat:** Everything "just in case" → Separate files
2. **Instruction Overload:** 50+ lines → <60 universally applicable
3. **No TDD for Skills:** Writing without testing → RED-GREEN-REFACTOR

## Quick Checklists

**CLAUDE.md:** <300 lines? Only universally applicable?

**Skills:** Failing test first? "Use when..." description? Under word limit?

**Commands:** 5-20 lines? 1-3 steps only?

## Rationalization

| Excuse | Reality |
|--------|---------|
| "Comprehensive is better" | Instructions have diminishing returns |
| "Auto-generation is faster" | CLAUDE.md affects everything - craft it |

## Detailed References

- `@reference-claude-md` - CLAUDE.md deep dive
- `@reference-plugin-dev` - Plugin development
- `@reference-skill-dev` - Skill TDD process
- `@reference-command-dev` - Command patterns
