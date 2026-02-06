# lsp-python

Python Language Server integration using Pyright for Claude Code.

## Description

Provides Python language server support for Python editing in Claude Code,
enabling features like type checking, completion, go-to-definition, and
diagnostics powered by [Pyright](https://github.com/microsoft/pyright).

## Installation

1. Install Pyright:

   ```bash
   npm install -g pyright
   ```

   Or using Bun:

   ```bash
   bun install -g pyright
   ```

2. Add this plugin to your Claude Code configuration.

3. The plugin will automatically attempt to install Pyright on session start
   if not found.

## Configuration

Create `pyrightconfig.json` in your project root for proper type checking:

```json
{
  "include": ["src"],
  "exclude": ["**/node_modules", "**/__pycache__", "**/tests"]
}
```

### Supported File Types

- `.py` - Python source files
- `.pyi` - Python stub files

## Features

- Type checking with static analysis
- Auto-completion
- Go-to-definition
- Find references
- Symbol search
- Diagnostics and error detection

## Requirements

- Node.js 14+ (for Pyright LSP server)
- Python 3.7+ (for type analysis)

## Hook

- **SessionStart**: Automatically checks for and installs Pyright if not present.

## Troubleshooting

### Pyright not found

Verify Pyright is installed:

```bash
which pyright
```

If not found, install manually:

```bash
npm install -g pyright
```

### Diagnostics not working

Ensure `pyrightconfig.json` exists in your project root (optional but recommended
for better results).

## References

- [Pyright GitHub](https://github.com/microsoft/pyright)
- [Pyright Documentation](https://github.com/microsoft/pyright/blob/main/docs/README.md)
