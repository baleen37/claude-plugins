# LSP Support

Language Server Protocol support for multiple programming languages. Provides code completion, diagnostics, go-to-definition, and other IDE features for Bash, TypeScript, JavaScript, Python, Go, Kotlin, Lua, and Nix.

## Supported Languages

- **Bash/Shell** - via [bash-language-server](https://github.com/bash-lsp/bash-language-server)
- **TypeScript/JavaScript** - via [typescript-language-server](https://github.com/typescript-language-server/typescript-language-server)
- **Python** - via [Pyright](https://github.com/microsoft/pyright)
- **Go** - via [gopls](https://github.com/golang/tools/tree/master/gopls)
- **Kotlin** - via [kotlin-language-server](https://github.com/fwcd/kotlin-language-server)
- **Lua** - via [lua-language-server](https://github.com/LuaLS/lua-language-server)
- **Nix** - via [nil](https://github.com/oxalica/nil)

---

## Bash/Shell LSP

### Installation

```bash
npm install -g bash-language-server
```

Note: `npm install -g` is used because bash-language-server is distributed as an npm package. You can also use `bun install -g` if you prefer Bun.

### Requirements

- Node.js 14+ (for bash-language-server)
- ShellCheck (optional, for enhanced diagnostics): `brew install shellcheck`

### Supported File Types

`.bash`, `.sh`, `.zsh`, and shell scripts with shebang (`#!/bin/bash`, `#!/bin/sh`)

---

## TypeScript/JavaScript LSP

### Installation

```bash
npm install -g typescript-language-server typescript
```

Note: `npm install -g` is used because typescript-language-server is distributed as an npm package. You can also use `bun install -g` if you prefer Bun.

### Requirements

- Node.js 16+ (for typescript-language-server)
- TypeScript (for TS files): `npm install -g typescript` or `bun install -g typescript`

### Supported File Types

`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`

### Configuration

Create `tsconfig.json` in your project root for proper type checking:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true
  }
}
```

---

## Python LSP

### Installation

```bash
npm install -g pyright
```

Note: `npm install -g` is used because Pyright is distributed as an npm package. You can also use `bun install -g` if you prefer Bun.

### Requirements

- Node.js 14+ (for Pyright)
- Python 3.7+ (system installation)

### Supported File Types

`.py`, `.pyi`

### Configuration

Create `pyrightconfig.json` in your project root:

```json
{
  "include": ["src"],
  "exclude": ["**/node_modules",
    "**/__pycache__"]
}
```

---

## Go LSP

### Installation

```bash
go install golang.org/x/tools/gopls@latest
```

### Requirements

- Go 1.18+

### Supported File Types

`.go`

### Configuration

Ensure `$GOPATH/bin` (or `$HOME/go/bin`) is in your PATH.

Initialize Go module if needed:

```bash
go mod init your/module
```

---

## Kotlin LSP

### Installation

```bash
brew install kotlin-language-server
```

### Requirements

- Homebrew
- Java runtime

### Supported File Types

`.kt`, `.kts`

---

## Lua LSP

### Installation

```bash
brew install lua-language-server
```

### Requirements

- Homebrew
- Lua 5.1+

### Supported File Types

`.lua`

---

## Nix LSP

### Installation

```bash
cargo install --git https://github.com/oxalica/nil nil
```

### Requirements

- Rust toolchain (cargo)
- Nix 2.4+

### Supported File Types

`.nix`

### Alternative: nixd

An alternative is **nixd** (more features, less stable):

```bash
cargo install --git https://github.com/nix-community/nixd nixd
```

---

## Usage

Once the LSP server is installed, Claude Code will automatically use it when editing files in the supported languages.

### Examples

- "Find the definition of this function"
- "Show me diagnostics for this file"
- "Complete this code"
- "What errors are in this file?"

---

## Troubleshooting

### LSP server not found

Verify the LSP server is installed:

```bash
# Bash
which bash-language-server

# TypeScript/JavaScript
which typescript-language-server

# Python
which pyright

# Go
which gopls

# Kotlin
which kotlin-language-server

# Lua
which lua-language-server

# Nix
which nil
```

### Diagnostics not working

- **Bash**: Install ShellCheck: `brew install shellcheck`
- **TypeScript**: Ensure `tsconfig.json` exists in your project
- **Python**: Ensure `pyrightconfig.json` exists (optional but recommended)
- **Go**: Ensure `go.mod` exists in your project

---

## References

- [bash-language-server](https://github.com/bash-lsp/bash-language-server)
- [typescript-language-server](https://github.com/typescript-language-server/typescript-language-server)
- [Pyright](https://github.com/microsoft/pyright)
- [gopls](https://github.com/golang/tools/tree/master/gopls)
