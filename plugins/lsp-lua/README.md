# LSP Lua

Lua Language Server Protocol support. Provides code completion, diagnostics,
go-to-definition, and other IDE features for Lua files via lua-language-server.

## Installation

### Install lua-language-server

```bash
brew install lua-language-server
```

### Requirements

- Homebrew
- Lua 5.1+

## Supported File Types

`.lua`

## Usage

Once lua-language-server is installed, Claude Code will automatically use it when
editing Lua files.

### Examples

- "Find the definition of this function"
- "Show me diagnostics for this file"
- "Complete this code"
- "What errors are in this file?"

## Troubleshooting

### LSP server not found

Verify lua-language-server is installed:

```bash
which lua-language-server
```

If not found, install via Homebrew:

```bash
brew install lua-language-server
```

### Diagnostics not working

Ensure your Lua project is properly configured. lua-language-server works best
with Lua 5.1+ and can be configured with `.luarc.json` or `lua.rc` files.

## References

- [lua-language-server](https://github.com/LuaLS/lua-language-server)
- [LuaLS Documentation](https://luals.github.io/)
