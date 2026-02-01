<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# .omc

## Purpose
oh-my-claudecode (OMC) state directory for session management, scientist reports, and ultrawork/ralph loop checkpoints.

## Key Files

| File | Description |
|------|-------------|
| `prd.json` | Product Requirements Document for active development |
| `progress.txt` | Current progress tracking |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `notepads/` | Session-specific notepads for context persistence |
| `sessions/` | Claude Code session history and metadata |
| `state/` | State files for ultrawork, checkpoints |
| `scientist/reports/` | Data scientist experiment reports |

## For AI Agents

### Working In This Directory
- Files are managed by oh-my-claudecode plugin
- Do not manually modify state files
- Session data includes transcripts and metadata
- Checkpoints store partial work for resumption

### Testing Requirements
- State files are transient and not tested
- Session persistence is validated by memory-persistence plugin tests

### Common Patterns
- Session IDs as directory names
- JSON format for structured data
- Timestamps in filenames for ordering

## Dependencies

### External
- **oh-my-claudecode** - OMC plugin that manages this directory

### Internal
- `plugins/memory-persistence/` - Related session persistence functionality

<!-- MANUAL: -->
