# Conversation Memory Migration Design

**Date:** 2026-02-03
**Status:** Approved
**Author:** Bot & Jiho

## Overview

Migrate `@obra/episodic-memory` to `plugins/memory/` as a standalone Claude Code plugin with conversation memory capabilities.

## Goals

- Import entire `@obra/episodic-memory` codebase (core library, CLI, MCP server)
- Restructure to match Claude Plugin architecture
- Rename from `episodic-memory` to `conversation-memory`
- Implement auto-indexing via SessionEnd hook
- Remove existing wrapper code completely

## Decisions

### 1. Migration Scope: Full Package
- **Chosen:** Import core library + MCP server + CLI + auto-indexing
- **Rationale:** Make `plugins/memory/` a complete standalone package with all episodic-memory features

### 2. Existing Code: Complete Replacement
- **Chosen:** Delete current wrapper code (`src/mcp/server.ts`, `src/lib/tool-mapper.ts`, `config/tools.json`)
- **Rationale:**
  - Current wrapper is experimental and unvalidated
  - `@obra/episodic-memory` is proven and complete
  - YAGNI: Don't build abstractions for hypothetical future provider switching

### 3. Dependency Management: Source Copy
- **Chosen:** Clone and copy source code from GitHub
- **Rationale:**
  - Full control for customization
  - Independent versioning within `claude-plugins` monorepo
  - No external dependency concerns

### 4. Directory Structure: Claude Plugin Standard
- **Chosen:** Reorganize to match other `claude-plugins` structure
- **Rationale:**
  - Consistency with other plugins
  - Integration with `.claude-plugin/plugin.json` and `.mcp.json`
  - Better organization for Claude Code ecosystem

### 5. CLI Commands: MCP Tools Only (Initially)
- **Chosen:** Implement MCP tools (`search`, `show`) first, defer slash commands
- **Rationale:**
  - MCP tools are core functionality (auto-invoked by Claude)
  - Slash commands are optional user-invoked features
  - Incremental migration reduces risk
  - Can add slash commands later if needed

### 6. Auto-Indexing: Immediate Implementation
- **Chosen:** Implement SessionEnd hook for automatic sync
- **Rationale:**
  - Core value proposition of episodic memory
  - Already implemented in original project
  - SessionEnd hook is standard Claude Plugin feature
  - Without this, plugin only searches but doesn't remember new conversations

### 7. Naming: conversation-memory
- **Chosen:** Use `conversation-memory` prefix for all public interfaces
- **Rationale:**
  - More descriptive than generic "memory"
  - Clearer than academic "episodic-memory"
  - Aligns with Claude Code's "conversation" terminology

## Architecture

### Directory Structure

```
plugins/memory/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── .mcp.json                     # MCP server registration
├── hooks/
│   └── SessionEnd.sh            # Auto-sync on session end
├── src/
│   ├── core/                    # From @obra/episodic-memory
│   │   ├── indexer.ts           # Conversation indexing
│   │   ├── searcher.ts          # Semantic + text search
│   │   ├── storage.ts           # SQLite + embeddings
│   │   └── types.ts             # Type definitions
│   ├── cli/                     # From @obra/episodic-memory
│   │   ├── sync.ts              # Sync command
│   │   ├── search.ts            # Search command
│   │   ├── show.ts              # Show command
│   │   └── stats.ts             # Stats command
│   ├── mcp/
│   │   └── server.ts            # MCP server (search, show tools)
│   └── lib/
│       └── config.ts            # Configuration management
├── dist/
│   ├── mcp-server.cjs           # Bundled MCP server
│   └── cli.cjs                  # Bundled CLI (for hooks)
├── scripts/
│   └── build.mjs                # esbuild config
├── package.json
├── tsconfig.json
└── README.md
```

### MCP Server

**Tool: `conversation-memory__search`**

Search past conversation history using semantic or text search.

Parameters:
- `query` (string, required): Search query
- `limit` (number, optional): Max results (default: 10)
- `mode` (string, optional): "vector" | "text" | "both" (default: "both")
- `before` (string, optional): Date filter YYYY-MM-DD
- `after` (string, optional): Date filter YYYY-MM-DD
- `response_format` (string, optional): "markdown" | "json" (default: "markdown")

**Tool: `conversation-memory__show`**

Read full conversation by path to extract detailed context.

Parameters:
- `path` (string, required): Conversation file path from search results
- `startLine` (number, optional): Start line for pagination
- `endLine` (number, optional): End line for pagination

Implementation:
- Uses core library classes (`Searcher`, `ConversationReader`)
- Registered in `.mcp.json` → `dist/mcp-server.cjs`

### Auto-Indexing

**SessionEnd Hook** (`hooks/SessionEnd.sh`):

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run sync in background to avoid blocking session end
node "${CLAUDE_PLUGIN_ROOT}/plugins/memory/dist/cli.cjs" sync 2>&1 | \
  logger -t "conversation-memory" &
```

Behavior:
- Triggered automatically when Claude Code session ends
- Scans `~/.claude/sessions/` for new/modified conversations
- Generates embeddings and stores in SQLite
- Runs in background (non-blocking)
- Silent on errors (retry on next sync)

### Configuration

- Storage location: `~/.claude/conversation-memory/`
  - `conversations.db` - SQLite database
  - `config.json` - User settings
- Exclusion marker: `.no-conversation-memory` in conversation directory
- Compatible with original `@obra/episodic-memory` data format

## Build & Dependencies

### package.json

```json
{
  "name": "@baleen/conversation-memory-plugin",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Conversation memory plugin with semantic search across Claude Code sessions",
  "scripts": {
    "build": "node scripts/build.mjs",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "@xenova/transformers": "^2.x",
    "better-sqlite3": "^9.x"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.x",
    "@types/node": "^20.0.0",
    "esbuild": "^0.20.0",
    "typescript": "^5.3.3"
  }
}
```

### Build Process

`scripts/build.mjs`:
- Entry point 1: `src/mcp/server.ts` → `dist/mcp-server.cjs`
- Entry point 2: `src/cli/*.ts` → `dist/cli.cjs` (bundled CLI)
- Bundle dependencies (transformers, sqlite3 native modules)
- Platform: node (CommonJS output for compatibility)

### Installation

1. `cd plugins/memory && npm install`
2. `npm run build`
3. First run auto-creates `~/.claude/conversation-memory/`
4. SessionEnd hook begins auto-syncing

## Naming Changes

| Original | New |
|----------|-----|
| `episodic-memory__search` | `conversation-memory__search` |
| `episodic-memory__show` | `conversation-memory__show` |
| `~/.claude/episodic-memory/` | `~/.claude/conversation-memory/` |
| `.no-episodic-memory` | `.no-conversation-memory` |
| Package: `@obra/episodic-memory` | `@baleen/conversation-memory-plugin` |

Internal code (class names, variable names) retained from original for simplicity.

## Files to Delete

- `src/mcp/server.ts` (wrapper implementation)
- `src/lib/tool-mapper.ts`
- `src/lib/config-loader.ts`
- `config/tools.json`
- `test-*.mjs` (old wrapper tests)

## Files to Preserve/Update

- `.claude-plugin/plugin.json` - Update description
- `.mcp.json` - Update server name and command
- `package.json` - Replace dependencies
- `README.md` - Rewrite for new implementation

## Success Criteria

- ✅ MCP tools (`conversation-memory__search`, `conversation-memory__show`) work
- ✅ SessionEnd hook auto-syncs conversations
- ✅ Semantic search returns relevant past conversations
- ✅ Storage in `~/.claude/conversation-memory/`
- ✅ No wrapper code remains
- ✅ Build produces `dist/mcp-server.cjs` and `dist/cli.cjs`

## Non-Goals

- Slash commands (deferred to future iteration)
- Multi-provider abstraction (YAGNI)
- Upstream sync with `@obra/episodic-memory` (independent fork)
- Migration of existing episodic-memory data (users can keep both)

## Future Enhancements

- Slash commands: `/memory search`, `/memory stats`
- Conversation tagging/categorization
- Export/import functionality
- Web UI for browsing history
- Integration with other plugins (e.g., context-restore)

## References

- Original project: https://github.com/obra/episodic-memory
- MCP Protocol: https://modelcontextprotocol.io
- Claude Plugins docs: https://github.com/anthropics/claude-code
