<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# commands

## Purpose
Ralph Loop slash commands - start loop, cancel loop, and display help.

## Key Files

| File | Description |
|------|-------------|
| `ralph-loop.md` | Start Ralph Loop with prompt and iteration limit |
| `cancel-ralph.md` | Cancel active Ralph Loop |
| `help.md` | Display Ralph Loop usage help |

## Subdirectories

None

## For AI Agents

### Working In This Directory
- Commands use YAML frontmatter
- ralph-loop creates state file and starts iteration
- cancel-ralph removes state file
- help displays usage information

### Testing Requirements
- Test loop creation and cancellation
- Verify help content is current
- Test with various iteration counts

### Common Patterns
- YAML frontmatter with title/description
- State files in `~/.claude/ralph-loop/`
- Session ID from environment

## Dependencies

### Internal
- `../hooks/` - SessionStop hook that implements looping
- `../scripts/` - Setup and control utilities

<!-- MANUAL: -->
