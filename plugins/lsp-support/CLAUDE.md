<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# lsp-support

## Purpose
Language Server Protocol support for Bash, TypeScript, JavaScript, Python, and Go - provides autocomplete, diagnostics, and code navigation.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Plugin documentation |
| `.claude-plugin/plugin.json` | Plugin manifest |

## Subdirectories

None (LSP configuration is external to plugin structure)

## For AI Agents

### Working In This Directory
- Provides LSP server configurations
- Supports multiple languages
- Configuration is typically in Claude Code settings
- Plugin documents LSP capabilities

### Testing Requirements
- Verify LSP server启动
- Test autocomplete for each language
- Validate diagnostics output

### Common Patterns
- LSP servers run as external processes
- Configuration via Claude Code settings
- Each language has its own LSP server

## Dependencies

### External
- **bash-language-server** - Bash LSP
- **typescript-language-server** - TypeScript/JavaScript LSP
- **pylsp** or **pyright** - Python LSP
- **gopls** - Go LSP

<!-- MANUAL: -->
