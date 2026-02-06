# LSP Go

Language Server Protocol support for Go programming language. Provides code
completion, diagnostics, go-to-definition, and other IDE features via
[gopls](https://github.com/golang/tools/tree/master/gopls).

## Installation

### gopls Installation

```bash
go install golang.org/x/tools/gopls@latest
```

The plugin will automatically attempt to install gopls on session start if not
found.

### Requirements

- Go 1.18+
- `$GOPATH/bin` (or `$HOME/go/bin`) in your PATH

## Supported File Types

`.go`

## Configuration

Initialize Go module in your project if needed:

```bash
go mod init your/module
```

## Usage

Once gopls is installed, Claude Code will automatically use it when editing Go
files.

### Examples

- "Find the definition of this function"
- "Show me diagnostics for this file"
- "Complete this code"
- "What errors are in this file?"
- "Find all references to this variable"

## Troubleshooting

### gopls not found

Verify gopls is installed and in your PATH:

```bash
which gopls
```

If not found, install manually:

```bash
go install golang.org/x/tools/gopls@latest
```

### Diagnostics not working

Ensure `go.mod` exists in your project root:

```bash
go mod init your/module
```

## References

- [gopls documentation](https://github.com/golang/tools/tree/master/gopls)
- [Go LSP documentation](https://go.dev/gopls)
