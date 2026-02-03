# Conversation Memory Plugin

Conversation memory plugin with semantic search across Claude Code sessions.

## Purpose

Gives Claude persistent memory across sessions by automatically indexing conversations and providing semantic
search capabilities. Based on [@obra/episodic-memory](https://github.com/obra/episodic-memory) with integration
into the Claude Code plugin ecosystem.

## Features

- **Automatic Indexing**: SessionEnd hook syncs conversations automatically
- **Semantic Search**: Vector embeddings for intelligent similarity matching
- **Text Search**: Fast exact-text matching for specific terms
- **Multi-Concept Search**: AND search across 2-5 concepts simultaneously
- **Date Filtering**: Search within specific time ranges
- **Conversation Reading**: Full conversation retrieval with pagination

## MCP Tools

### `conversation-memory__search`

Restores context by searching past conversations. Claude doesn't automatically remember past sessions—this tool
recovers decisions, solutions, and avoids reinventing work.

**Parameters:**

- `query` (string | string[], required): Search query (single string for semantic search, array of 2-5 strings for
  multi-concept AND search)
- `limit` (number, optional): Maximum results to return (1-50, default: 10)
- `mode` (string, optional): Search mode - "vector", "text", or "both" (default: "both", only for single-concept)
- `before` (string, optional): Only conversations before this date (YYYY-MM-DD)
- `after` (string, optional): Only conversations after this date (YYYY-MM-DD)
- `response_format` (string, optional): "markdown" or "json" (default: "markdown")

**Examples:**

```javascript
// Semantic search
{ query: "React Router authentication errors" }

// Text search for exact match
{ query: "a1b2c3d4e5f6", mode: "text" }

// Multi-concept AND search
{ query: ["React Router", "authentication", "JWT"] }

// Date filtering
{ query: "refactoring", after: "2025-09-01" }
```

### `conversation-memory__read`

Reads full conversations to extract detailed context after finding relevant results with search. Essential for
understanding complete rationale, evolution, and gotchas behind past decisions.

**Parameters:**

- `path` (string, required): Conversation file path from search results
- `startLine` (number, optional): Starting line number (1-indexed) for pagination
- `endLine` (number, optional): Ending line number (1-indexed) for pagination

## Installation

```bash
# Install dependencies
cd plugins/memory
npm install

# Build the plugin
npm run build
```

The plugin automatically:

1. Creates `~/.claude/conversation-memory/` directory
2. Begins indexing conversations via SessionEnd hook
3. Provides MCP tools for semantic search

## How It Works

### Automatic Indexing (SessionEnd Hook)

When each Claude Code session ends, the hook (`hooks/SessionEnd.sh`) runs:

```bash
node dist/cli.mjs sync
```

This:

1. Scans `~/.claude/sessions/` for new/modified conversations
2. Generates embeddings using Transformers.js
3. Stores in SQLite database (`~/.claude/conversation-memory/conversations.db`)
4. Runs in background (non-blocking, silent on errors)

### Storage Structure

```text
~/.claude/conversation-memory/
├── conversations.db          # SQLite database with embeddings
└── config.json              # User settings (optional)
```

### Exclusion

To exclude specific conversation directories from indexing, create a `.no-conversation-memory` marker file:

```bash
touch /path/to/conversation/dir/.no-conversation-memory
```

## Development

### Build

```bash
npm run build
```

Bundles:

- `src/mcp/server.ts` → `dist/mcp-server.mjs` (MCP server)
- `src/cli/index-cli.ts` → `dist/cli.mjs` (CLI for hooks)

### Type Check

```bash
npm run typecheck
```

### Project Structure

```text
plugins/memory/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── .mcp.json                     # MCP server registration
├── hooks/
│   └── SessionEnd.sh            # Auto-sync on session end
├── src/
│   ├── core/                    # Core library (from @obra/episodic-memory)
│   │   ├── indexer.ts           # Conversation indexing
│   │   ├── searcher.ts          # Semantic + text search
│   │   ├── storage.ts           # SQLite + embeddings
│   │   └── types.ts             # Type definitions
│   ├── cli/                     # CLI commands
│   │   ├── sync-cli.ts          # Sync command
│   │   ├── search-cli.ts        # Search command
│   │   ├── show-cli.ts          # Show command
│   │   └── stats-cli.ts         # Stats command
│   └── mcp/
│       └── server.ts            # MCP server (search, read tools)
├── dist/
│   ├── mcp-server.mjs           # Bundled MCP server
│   └── cli.mjs                  # Bundled CLI (for hooks)
├── scripts/
│   └── build.mjs                # esbuild config
├── package.json
├── tsconfig.json
└── README.md
```

## Dependencies

### Runtime

- `@anthropic-ai/claude-agent-sdk`: ^0.1.9 - For conversation summarization
- `@modelcontextprotocol/sdk`: ^1.0.4 - MCP protocol implementation
- `@huggingface/transformers`: ^3.8.1 - ML embeddings (Transformers.js v3)
- `better-sqlite3`: ^9.6.0 - SQLite database
- `sqlite-vec`: ^0.1.6 - Vector similarity search extension
- `zod`: ^3.22.4 - Schema validation

### Development Dependencies

- `typescript`: ^5.3.3
- `esbuild`: ^0.20.0
- `@types/node`: ^20.0.0
- `@types/better-sqlite3`: ^7.6.11

## Upgrading from v1.x (multilingual-e5-small)

**IMPORTANT**: Version 2.0+ uses EmbeddingGemma with 768-dimensional embeddings (vs 384 in v1.x).
The database must be recreated as vector dimensions are incompatible.

### Migration Steps

```bash
# 1. Backup existing database (optional)
cp ~/.claude/conversation-memory/conversations.db \
   ~/.claude/conversation-memory/conversations.db.backup

# 2. Remove old database
rm ~/.claude/conversation-memory/conversations.db

# 3. Reinstall plugin dependencies
cd plugins/conversation-memory
npm install

# 4. Rebuild plugin
npm run build

# 5. Reindex all conversations (downloads ~197MB model on first run)
node dist/cli.mjs index-all
```

**First sync timing**:

- Model download: ~197MB (one-time, cached to `.cache/`)
- Reindexing time: Varies by conversation count
- Initial ONNX runtime warmup: ~30 seconds

### What's New in v2.0

- ✅ **Better Korean Support**: 83.86 MRR@10 (vs 55.4 in v1.x) - **+51% improvement**
- ✅ **100+ Languages**: Multilingual coverage including Korean, Japanese, Chinese, etc.
- ✅ **Higher Dimensions**: 768-dim embeddings (vs 384) for better semantic representation
- ✅ **Memory Efficient**: < 200MB RAM usage with Q4 quantization
- ✅ **Official Package**: Migrated to `@huggingface/transformers` v3

## Architecture Notes

- **Standalone Plugin**: Complete implementation (not a wrapper)
- **Based on @obra/episodic-memory**: Forked and integrated into Claude Code plugin ecosystem
- **Storage Location**: `~/.claude/conversation-memory/` (not `.config/superpowers`)
- **Naming**: All public interfaces use `conversation-memory` for clarity
- **Embedding Model**: Google EmbeddingGemma-300M (ONNX, Q4 quantized)
  - 768 dimensions (Matryoshka-enabled: 128-768)
  - 100+ languages including Korean (MRR@10: 83.86 on XTREME-UP)
  - Model size: ~197MB (Q4 quantization)
  - Memory usage: < 200MB RAM
  - MTEB Multilingual score: 60.62
  - Task prefix: "title: none | text: ..." (automatically applied)

## Future Enhancements

- Slash commands: `/conversation-memory search`, `/conversation-memory stats`
- Conversation tagging/categorization
- Export/import functionality
- Web UI for browsing history
- Integration with other plugins (e.g., context-restore)

## References

- Original project: [episodic-memory](https://github.com/obra/episodic-memory)
- MCP Protocol: [Model Context Protocol](https://modelcontextprotocol.io)
- Claude Code: [anthropics/claude-code](https://github.com/anthropics/claude-code)

## License

MIT
