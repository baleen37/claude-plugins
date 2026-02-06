# lsp-typescript

TypeScript/JavaScript Language Server integration for Claude Code.

## Description

Provides TypeScript and JavaScript language server support for code editing in
Claude Code, enabling features like syntax checking, completion, diagnostics,
go-to-definition, and more.

## Supported Languages

- **TypeScript** - `.ts`, `.tsx`
- **JavaScript** - `.js`, `.jsx`, `.mjs`, `.cjs`

## Installation

### Install TypeScript Language Server

```bash
bun install -g typescript-language-server typescript
```

Note: `bun install -g` is used because typescript-language-server is
distributed as an npm package. You can also use `npm install -g` if you prefer
npm.

### Requirements

- Node.js 16+ (for typescript-language-server)
- TypeScript (for TS files): `bun install -g typescript` or
  `npm install -g typescript`

## Configuration

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

## Hook

- **SessionStart**: Automatically checks/install TypeScript Language Server on
  session start.

## Usage

Once the LSP server is installed, Claude Code will automatically use it when
editing TypeScript or JavaScript files.

### Examples

- "Find the definition of this function"
- "Show me diagnostics for this file"
- "Complete this code"
- "What errors are in this file?"
- "Rename this variable across all files"

## Troubleshooting

### LSP server not found

Verify the LSP server is installed:

```bash
which typescript-language-server
```

### Diagnostics not working

Ensure `tsconfig.json` exists in your project root with appropriate compiler
options.

### Type definitions not found

Install type definitions for libraries you use:

```bash
bun add -d @types/node
bun add -d @types/react
```

## References

- [typescript-language-server](https://github.com/typescript-language-server/typescript-language-server)
- [TypeScript](https://www.typescriptlang.org/)
