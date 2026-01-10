# Plugin Development Guide

## Standard Plugin Structure

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Required: Plugin manifest
├── commands/                # Optional: Slash commands
│   └── my-command.md
├── agents/                  # Optional: Specialized agents
│   └── my-agent.md
├── skills/                  # Optional: Agent skills
│   └── my-skill/
│       └── SKILL.md
├── hooks/
│   ├── hooks.json           # Required for hooks: Event bindings
│   └── *.sh                 # Hook scripts
├── scripts/                 # Optional: Utility scripts
│   └── setup.sh
├── .mcp.json                # Optional: MCP server config
└── README.md                # Required: Documentation
```

## plugin.json Reference

```json
{
  "name": "plugin-name",           // Required
  "version": "1.0.0",              // Required: semver
  "description": "Brief description", // Required
  "author": "Author Name",         // Optional
  "homepage": "https://...",       // Optional
  "repository": "https://...",     // Optional
  "license": "MIT",                // Optional
  "keywords": ["tag1", "tag2"]     // Optional: For discovery
}
```

### Naming Rules

- Plugin name: `lowercase-with-hyphens` only
- Valid characters: lowercase letters, numbers, hyphens
- No spaces, underscores, or special characters

## Component Types

### Commands (Slash Commands)

**Purpose:** Thin entry points for simple tasks

**When to use:**
- 1-3 steps
- 5-20 lines of prompt
- Direct instructions OR skill delegation

**Location:** `commands/my-command.md`

**Structure:**
```markdown
---
description: Brief description of what this does
allowed-tools: Bash(git:*), Read, Edit
argument-hint: [optional-arg]
---

Your prompt here (5-20 lines)
```

**For detailed guidance:** See @reference-command-dev

### Skills

**Purpose:** Reusable workflows with proven patterns

**When to use:**
- 4+ steps
- Decision trees
- Checklists
- Structured outputs

**Location:** `skills/my-skill/SKILL.md`

**Structure:**
```markdown
---
name: skill-name
description: Use when [trigger condition]
---

# Skill Content
```

**For detailed guidance:** See @reference-skill-dev

### Agents

**Purpose:** Autonomous specialists with dedicated tools

**When to use:**
- Task requires autonomous execution
- Specialized tool access needed
- Different model settings beneficial

**Location:** `agents/my-agent.md`

**Structure:**
```markdown
---
description: What this agent does
model: claude-opus-4-5-20251101
allowed-tools: Bash, Read, Write, Edit
---

You are a specialist agent for...
```

### Hooks

**Purpose:** Event-driven automation

**Events:** SessionStart, SessionStop, etc.

**Location:**
- `hooks/hooks.json` - Event bindings
- `hooks/*.sh` - Script implementations

**hooks.json structure:**
```json
{
  "SessionStart": ["./hooks/session-start.sh"],
  "SessionStop": ["./hooks/session-stop.sh"]
}
```

**Hook script requirements:**
```bash
#!/bin/bash
set -euo pipefail  # ALWAYS: Error detection
# Use jq for JSON parsing
# Use ${CLAUDE_PLUGIN_ROOT} for portability
# Error messages to stderr (>&2)
# Return 0 on success, non-0 on failure
```

**Example hook script:**
```bash
#!/bin/bash
set -euo pipefail

# Get plugin root
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Parse input
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId')

# Do work
echo "Session started: $SESSION_ID" >&2

# Return success
exit 0
```

## Path Portability

**ALWAYS use `${CLAUDE_PLUGIN_ROOT}` instead of absolute paths.**

**BAD:**
```bash
CONFIG_FILE="/Users/username/.claude/plugins/my-plugin/config.json"
```

**GOOD:**
```bash
CONFIG_FILE="${CLAUDE_PLUGIN_ROOT}/config.json"
```

## MCP Servers

**Purpose:** Integrate external tools and APIs

**Location:** `.mcp.json` (plugin root or `~/.claude/`)

**Structure:**
```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {
        "API_KEY": "your-key"
      }
    }
  }
}
```

## Installation

### Project-Level

1. Create plugin directory in project
2. Reference in `.claude/settings.json`:
```json
{
  "plugins": [
    "./plugins/my-plugin"
  ]
}
```

### User-Level

1. Create plugin directory in `~/.claude/plugins/`
2. Add to `~/.claude/settings.json`

## Validation

**Required files:**
- `.claude-plugin/plugin.json`
- `README.md`

**Validation checks:**
- plugin.json has required fields
- JSON syntax is valid
- marketplace.json (if publishing) is synchronized

**Run validation:**
```bash
# Using claude-code-marketplace scripts
python scripts/validate_plugin.py ./plugins/my-plugin
```

## README Requirements

Plugin README should include:
- Purpose and overview
- Installation instructions
- Usage examples for each command/agent
- Configuration options
- Troubleshooting section

## Sources

- [Claude Code Plugins README](https://github.com/anthropics/claude-code/blob/main/plugins/README.md)
- [PLUGIN_SCHEMA.md](https://github.com/ananddtyagi/claude-code-marketplace/blob/main/PLUGIN_SCHEMA.md)
