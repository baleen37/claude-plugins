# CLAUDE.md Deep Dive

## Purpose and Placement

CLAUDE.md automatically loads into EVERY conversation. This makes it the highest-leverage configuration point - for better or worse.

### Placement Options

| Location | Scope | When It Loads |
|----------|-------|---------------|
| `CLAUDE.md` (repo root) | Project | Every session in this repo |
| `CLAUDE.local.md` | Project (gitignored) | Every session, personal |
| `dir/CLAUDE.md` | Subdirectory | When working in that subdir |
| `~/.claude/CLAUDE.md` | Global | EVERY session, all repos |

## What CLAUDE.md Should Contain

### The WHY-WHAT-HOW Framework

**WHY:** Project purpose and goals
- What problem does this solve?
- What are the core business requirements?

**WHAT:** Tech stack and structure
- Frameworks, languages, key libraries
- Monorepo layout: apps/, packages/, services/
- What each directory/part is for

**HOW:** Working with the codebase
- Build commands (bun vs node, scripts)
- Test running procedures
- Verification methods
- Environment setup pointers

### Example Good CLAUDE.md

```markdown
# Baleen Claude Plugins

AI assistant plugins for Claude Code CLI.

## Stack
- TypeScript
- BATS for testing
- Bash for hooks/scripts

## Structure
- `plugins/ralph-loop/` - Ralph Wiggum iterative development
- `plugins/example-plugin/` - Plugin template
- `plugins/me/` - Personal workflow automation

## Commands
```bash
bats tests/              # Run all tests
pre-commit run --all-files  # Run pre-commit hooks
```

## Task-Specific Docs
When working on specific areas, read:
- `docs/DEVELOPMENT.md` - Component development
- `docs/TESTING.md` - Testing procedures
```

**30 lines. Universally applicable. Task-specific docs separated.**

## What CLAUDE.md Should NOT Contain

### Code Style Guidelines

**BAD:**
```markdown
## Code Style
- Use 2 spaces for indentation
- Prefer const over let
- Use arrow functions for callbacks
...
```

**Why bad:** Linters (Biome, prettier, ESLint) do this cheaper, faster, better.

**Fix:** Set up linter with auto-fix. Use Stop hook to run on changes.

### Task-Specific Instructions

**BAD:**
```markdown
## Database Schema
The users table has...
When adding a new column, first...
Migration procedure involves...
```

**Why bad:** Only relevant when working on database. Ignored otherwise.

**Fix:** Create `docs/database.md`, reference in CLAUDE.md:

```markdown
## Task-Specific Docs
When working on database: read `docs/database.md`
```

### Every Possible Command

**BAD:**
```markdown
## Available Commands
npm run build          # Build the project
npm run test           # Run tests
npm run lint           # Lint code
npm run format         # Format code
npm run typecheck      # Type checking
npm run dev            # Start dev server
npm run prod           # Start production server
...
```

**Why bad:** Claude won't remember all of these. Bloats context.

**Fix:** Core commands only. Rest in `docs/building.md` or package.json scripts.

## The Progressive Disclosure Pattern

Instead of cramming everything into CLAUDE.md:

1. **Keep CLAUDE.md lean** (<60 lines ideal)
2. **Create task-specific docs** with self-descriptive names
3. **Reference them** in CLAUDE.md with brief descriptions

### Example Structure

```
project/
├── CLAUDE.md              # 40 lines: core info + doc list
├── docs/
│   ├── building.md        # Build commands
│   ├── testing.md         # Test procedures
│   ├── database.md        # Schema guide
│   ├── deployment.md      # Deploy process
│   └── architecture.md    # System design
```

In CLAUDE.md:
```markdown
## Task-Specific Documentation

When starting specific tasks, read these first:
- `docs/building.md` - Build, clean, watch commands
- `docs/testing.md` - Unit, integration, E2E tests
- `docs/database.md` - Schema, migrations, queries
```

**Claude reads ONLY what's relevant for the current task.**

## Why Claude Ignores CLAUDE.md

Claude Code wraps CLAUDE.md in:

```
<system-reminder>
IMPORTANT: this context may or may not be relevant to your tasks.
You should not respond to this context unless it is highly relevant to the current task.
</system-reminder>
```

**Result:** Claude ignores contents it decides are "not relevant."

The more task-specific info in CLAUDE.md, the more likely it gets ignored.

## Token Efficiency

### Instruction Following vs Instruction Count

Research shows:
- Frontier LLMs: ~150-200 instructions with reasonable consistency
- Smaller models: Fewer, exponential decay
- Claude Code system prompt: ~50 instructions already
- Your CLAUDE.md: Should add minimal instructions

**Implication:** Every line in CLAUDE.md costs instruction-following capacity.

### Context Window Usage

**Better:** Context full of RELEVANT code, tool results, examples
**Worse:** Context bloated with irrelevant instructions

CLAUDE.md goes into EVERY session. Keep it lean.

## CLAUDE.md Anti-Patterns Summary

| Pattern | Problem | Solution |
|---------|---------|----------|
| Code style guides | Linters do this better | Use Biome/prettier |
| Task-specific instructions | Ignored as irrelevant | Separate docs |
| Every command listed | Context bloat | Core only |
| >300 lines | Overwhelming | <60 ideal |
| Auto-generated | Not curated | Craft carefully |

## Sources

- [Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md) by Kyle @ HumanLayer
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices) by Anthropic
