<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# agents

## Purpose
Autonomous specialist agents for code review and web research tasks.

## Key Files

| File | Description |
|------|-------------|
| `code-reviewer.md` | Code review specialist |
| `web-researcher.md` | Web research for documentation and best practices |

## Subdirectories

None

## For AI Agents

### Working In This Directory
- Agents define autonomous behavior
- Specify model and tool access
- Agents can be launched by Task tool
- Each agent has specific expertise

### Testing Requirements
- Test agent invocation
- Verify agent produces expected outputs
- Ensure agent tool access is correct

### Common Patterns
- YAML frontmatter for metadata
- Model specification (sonnet, opus, haiku)
- Tool access list
- Clear task description

## Dependencies

### Internal
- `../commands/` - Commands that launch agents
- `../skills/` - Related skills

<!-- MANUAL: -->
