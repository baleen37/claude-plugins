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
Use ast_grep_search to find all function declarations in JavaScript files
```

Search with meta-variables:
```
Find all const declarations: pattern "const $NAME = $VALUE"
```

### Transform Code

Remove console.log statements (dry-run):
```
Use ast_grep_replace to remove console.log statements
Pattern: console.log($$$ARGS)
Replacement: (empty)
```

Convert var to const:
```
Replace all var with const in JavaScript files
Pattern: var $NAME = $VALUE
Replacement: const $NAME = $VALUE
Set dryRun: false to apply changes
```

## Supported Languages

JavaScript, TypeScript, TSX, Python, Ruby, Go, Rust, Java, Kotlin, Swift, C, C++, C#, HTML, CSS, JSON, YAML

## Meta-variables

- `$VAR`: Matches any single AST node (identifier, expression, etc.)
- `$$$ARGS`: Matches multiple nodes (function arguments, list items, etc.)

### Examples

**Find function calls:**
```
Pattern: $FUNC($$$ARGS)
Matches: foo(), bar(1, 2), baz(x, y, z)
```

**Rename functions:**
```
Pattern: function oldName($$$PARAMS) { $$$BODY }
Replacement: function newName($$$PARAMS) { $$$BODY }
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
- **Tools**: Implemented in `src/tools/`
- **Transport**: stdio (Standard I/O)

## License

Part of Baleen Claude Plugins collection.
