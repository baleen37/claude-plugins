# AST Tools Plugin

AST-based code search and transformation tools for Claude Code using [ast-grep](https://ast-grep.github.io/).

## Overview

This plugin provides two powerful tools for code analysis and refactoring:

- **`ast_grep_search`**: Search for code patterns using AST matching
- **`ast_grep_replace`**: Transform code while preserving structure

## Features

- 🔍 **Semantic Search**: Find code by structure, not just text
- 🔄 **Safe Refactoring**: Transform code while preserving semantics
- 🎯 **Meta-variables**: Capture and reuse code fragments
- 🌐 **18 Languages**: JavaScript, TypeScript, Python, Go, Rust, and more
- 🛡️ **Dry-run Mode**: Preview changes before applying

## Installation

```bash
# Install the plugin
claude plugin install ast-tools

# Install ast-grep globally (optional, for better performance)
npm install -g @ast-grep/napi
```

## Usage

### Search for Code Patterns

Find all function declarations:
```
Use ast_grep_search to find all function declarations in TypeScript files
Pattern: "function $NAME($$$ARGS) { $$$BODY }"
```

Find all console.log calls:
```
Search for console.log calls in JavaScript
Pattern: "console.log($$$ARGS)"
```

Find React useEffect hooks:
```
Find all useEffect hooks in React components
Pattern: "useEffect($$$CALLBACK, $$$DEPS)"
```

### Transform Code

**Remove console.log statements (dry-run):**
```
Use ast_grep_replace to remove console.log statements
Pattern: console.log($$$ARGS)
Replacement: (leave empty)
```

**Convert var to const/let:**
```
Replace all var with const in JavaScript files
Pattern: var $NAME = $VALUE
Replacement: const $NAME = $VALUE
Set dryRun: false to apply changes
```

**Rename function:**
```
Rename fetchData to fetchUserData
Pattern: function fetchData($$$ARGS) { $$$BODY }
Replacement: function fetchUserData($$$ARGS) { $$$BODY }
```

**Convert forEach to for-of:**
```
Convert array.forEach to for...of loop
Pattern: $ARRAY.forEach(($ITEM) => { $$$BODY })
Replacement: for (const $ITEM of $ARRAY) { $$$BODY }
```

## Supported Languages

| Language | Extensions |
|----------|------------|
| JavaScript | `.js`, `.mjs`, `.cjs`, `.jsx` |
| TypeScript | `.ts`, `.mts`, `.cts`, `.tsx` |
| Python | `.py` |
| Ruby | `.rb` |
| Go | `.go` |
| Rust | `.rs` |
| Java | `.java` |
| Kotlin | `.kt`, `.kts` |
| Swift | `.swift` |
| C | `.c`, `.h` |
| C++ | `.cpp`, `.cc`, `.cxx`, `.hpp` |
| C# | `.cs` |
| HTML | `.html`, `.htm` |
| CSS | `.css` |
| JSON | `.json` |
| YAML | `.yaml`, `.yml` |

## Meta-variables

- `$VAR`: Matches any single AST node (identifier, expression, etc.)
- `$$$ARGS`: Matches multiple nodes (function arguments, list items, etc.)

### Examples

**Find function calls:**
```
Pattern: $FUNC($$$ARGS)
Matches: foo(), bar(1, 2), baz(x, y, z)
```

**Find destructuring:**
```
Pattern: const { $$$PROPS } = $OBJ
Matches: const { name, age } = user
```

**Find template literals:**
```
Pattern: `$CONTENT`
Matches: any template literal string
```

**Find arrow functions:**
```
Pattern: ($$$ARGS) => { $$$BODY }
Matches: (x, y) => { return x + y }
```

## Tool Schemas

### ast_grep_search

```typescript
{
  pattern: string;        // AST pattern with meta-variables
  language: string;       // One of 18 supported languages
  path?: string;          // File or directory (default: ".")
  context?: number;       // Context lines (default: 2, max: 10)
  maxResults?: number;    // Max results (default: 20, max: 100)
}
```

### ast_grep_replace

```typescript
{
  pattern: string;        // Pattern to match
  replacement: string;    // Replacement pattern
  language: string;       // Programming language
  path?: string;          // File or directory (default: ".")
  dryRun?: boolean;       // Preview only (default: true)
}
```

## Requirements

- **Optional**: `@ast-grep/napi` for full functionality
- If not installed, tools will show installation instructions

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Type check
npm run typecheck
```

## Architecture

- **Plugin Type**: Hybrid (Plugin + MCP Server)
- **MCP Server**: Bundled in `dist/mcp-server.cjs`
- **Tools**: Single-file implementation in `src/tools/ast-tools.ts`
- **Transport**: stdio (Standard I/O)

## Common Use Cases

### Code Audit

Find all TODO comments:
```
Pattern: TODO($$$MSG)
```

Find all any types:
```
Pattern: $VAR: any
```

Find all debugger statements:
```
Pattern: debugger
```

### Refactoring

Convert promise chains to async/await:
```
Pattern: $PROMISE.then($$$CB1).catch($$$CB2)
Replacement: async () => { try { $$$CB1 } catch { $$$CB2 } }
```

Remove unused imports:
```
Pattern: import $$$IMPORTS from '$MODULE'
```

### Migration

Migrate to new API:
```
Pattern: oldApi.method($$$ARGS)
Replacement: newApi.method($$$ARGS)
```

## License

Part of Baleen Claude Plugins collection.
