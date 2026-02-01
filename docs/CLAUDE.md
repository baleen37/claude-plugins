<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# docs

## Purpose
Development documentation including setup guides, testing instructions, and architectural decision records.

## Key Files

| File | Description |
|------|-------------|
| `DEVELOPMENT.md` | Plugin development guide - how to create commands, agents, skills, hooks |
| `TESTING.md` | Testing guide - how to write and run tests |
| `GITHUB_APP_SETUP.md` | GitHub App setup for automated releases |
| `release-with-github-app.yml` | Workflow configuration reference |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `plans/` | Project planning documents and ADRs |

## For AI Agents

### Working In This Directory
- Documentation uses Markdown format
- Keep docs in sync with code changes
- Update DEVELOPMENT.md when adding new plugin types
- Include code examples in documentation

### Testing Requirements
- Verify code examples are runnable
- Check all links are valid
- Ensure instructions match current implementation

### Common Patterns
- Use fenced code blocks with language identifiers
- Include directory structure diagrams where helpful
- Reference relevant schema files
- Cross-link related documentation

## Dependencies

### Internal
- `CLAUDE.md` - Main project documentation
- `schemas/` - Referenced in development guide
- `plugins/` - Examples shown in docs

<!-- MANUAL: -->
