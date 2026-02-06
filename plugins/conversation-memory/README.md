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
- **Project Filtering**: Search within specific projects for more relevant results
- **Date Filtering**: Search within specific time ranges
- **Conversation Reading**: Full conversation retrieval with pagination
- **Inline Exclusion Markers**: Exclude sensitive conversations with `DO NOT INDEX THIS CHAT`
- **Index Verification**: Check index health and repair issues
- **CLI Interface**: Direct CLI access for manual operations

## Agents

### `search-conversation`

Specialized agent for searching and synthesizing conversation history.
Saves 50-100x context by returning synthesized insights instead of raw
conversation data.

**The agent automatically:**

1. Searches using semantic + text search
2. Reads top 2-5 relevant conversations
3. Synthesizes findings into 200-1000 word summary
4. Returns actionable insights with sources

**Always use the agent instead of MCP tools directly** to avoid wasting context.

See `agents/search-conversation.md` for implementation details.

## Skills

### `remembering-conversations`

A skill that guides Claude to search conversation history before reinventing solutions or repeating mistakes.

**Core principle:** Always dispatch the search-conversation agent. Never use MCP tools directly.

**When to use:**

- User asks "how should I..." or "what's the best approach..."
- You're stuck after investigating a problem
- User references past work ("last time", "we discussed", etc.)
- Need to follow an unfamiliar workflow

**What it does:**

- Forces agent delegation (YOU MUST dispatch search-conversation agent)
- Prevents direct MCP tool usage (wastes context)
- Saves 50-100x context vs. loading raw conversations

See `skills/remembering-conversations/SKILL.md` for complete usage guide.

## MCP Tools

**⚠️ Warning:** Direct MCP tool usage is discouraged. Always use the
`search-conversation` agent instead to save 50-100x context.

These tools are exposed for advanced usage only. See `skills/remembering-conversations/MCP-TOOLS.md` for complete API reference.

### `conversation-memory__search`

Restores context by searching past conversations. Claude doesn't automatically remember past sessions—this tool
recovers decisions, solutions, and avoids reinventing work.

**Use the search-conversation agent instead of calling this directly.**

**Parameters:**

- `query` (string | string[], required): Search query (single string for semantic search, array of 2-5 strings for
  multi-concept AND search)
- `limit` (number, optional): Maximum results to return (1-50, default: 10)
- `mode` (string, optional): Search mode - "vector", "text", or "both" (default: "both", only for single-concept)
- `before` (string, optional): Only conversations before this date (YYYY-MM-DD)
- `after` (string, optional): Only conversations after this date (YYYY-MM-DD)
- `projects` (string[], optional): Filter results to specific project names
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

// Project filtering
{ query: "authentication", projects: ["my-project"] }
```

### `conversation-memory__read`

Reads full conversations to extract detailed context after finding relevant results with search. Essential for
understanding complete rationale, evolution, and gotchas behind past decisions.

**Use the search-conversation agent instead of calling this directly.**

**Parameters:**

- `path` (string, required): Conversation file path from search results
- `startLine` (number, optional): Starting line number (1-indexed) for pagination
- `endLine` (number, optional): Ending line number (1-indexed) for pagination

## Installation

```bash
# Install dependencies
cd plugins/conversation-memory
bun install

# Build the plugin
bun run build
```

The plugin automatically:

1. Creates `~/.config/conversation-memory/` directory
2. Begins indexing conversations via SessionEnd hook
3. Provides MCP tools for semantic search

## How It Works

### Automatic Indexing (SessionStart Hook)

When each Claude Code session starts (startup or resume), the hook (`hooks/hooks.json`) runs:

```bash
node dist/cli.mjs sync
```

This:

1. Scans `~/.claude/sessions/` for new/modified conversations
2. Generates embeddings using Transformers.js
3. Stores in SQLite database (`~/.config/conversation-memory/conversations.db`)
4. Runs in background (non-blocking, silent on errors)

### Storage Structure

```text
~/.config/conversation-memory/
├── conversations.db          # SQLite database with embeddings
└── config.json              # User settings (optional)
```

### Exclusion

There are two ways to exclude conversations from indexing:

**1. Directory-level exclusion:**

Create a `.no-conversation-memory` marker file in the conversation directory:

```bash
touch /path/to/conversation/dir/.no-conversation-memory
```

**2. Inline content exclusion:**

Include one of these markers anywhere in the conversation content:

- `DO NOT INDEX THIS CHAT`
- `DO NOT INDEX THIS CONVERSATION`
- `이 대화는 인덱싱하지 마세요` (Korean)
- `이 대화는 검색에서 제외하세요` (Korean)

The entire conversation will be excluded from indexing when any of these markers are detected.

### Environment Variables (Optional)

The plugin supports optional environment variables for customizing the summarization API:

- **`CONVERSATION_MEMORY_API_MODEL`**: Model to use for summarization (default: `haiku`)

  ```bash
  export CONVERSATION_MEMORY_API_MODEL="sonnet"
  ```

- **`CONVERSATION_MEMORY_API_BASE_URL`**: Custom Anthropic API endpoint

  ```bash
  export CONVERSATION_MEMORY_API_BASE_URL="https://api.anthropic.com"
  ```

- **`CONVERSATION_MEMORY_API_TOKEN`**: Authentication token for custom API endpoint

  ```bash
  export CONVERSATION_MEMORY_API_TOKEN="sk-ant-..."
  ```

- **`CONVERSATION_MEMORY_API_TIMEOUT_MS`**: API call timeout in milliseconds (default: SDK default)

  ```bash
  export CONVERSATION_MEMORY_API_TIMEOUT_MS="30000"
  ```

**Note**: If these variables are not set, the plugin uses Claude Code's default Anthropic API
configuration (subscription-based or `ANTHROPIC_API_KEY`).

## Development

### Build

```bash
bun run build
```

Bundles:

- `src/mcp/server.ts` → `dist/mcp-server.mjs` (MCP server)
- `src/cli/index-cli.ts` → `dist/cli.mjs` (CLI for hooks)

### Type Check

```bash
bun run typecheck
```

### CLI Usage

The plugin provides a CLI interface for manual operations:

```bash
# Show help
conversation-memory --help

# Sync new conversations
conversation-memory sync

# Sync with parallel summarization
conversation-memory sync --concurrency 4

# Index a specific session
conversation-memory index-session 2025-02-06-123456

# Verify index health
conversation-memory verify

# Repair detected issues
conversation-memory repair

# Rebuild entire index
conversation-memory rebuild --concurrency 8
```

### Project Structure

```text
plugins/conversation-memory/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── .mcp.json                     # MCP server registration
├── hooks/
│   └── hooks.json               # Auto-sync on session start (startup|resume)
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
│   ├── mcp-wrapper.mjs          # Cross-platform wrapper
│   └── cli.mjs                  # Bundled CLI (for hooks)
├── scripts/
│   ├── build.mjs                # esbuild config
│   └── mcp-server-wrapper.mjs   # Wrapper script
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
- `bun`: For build and test runtime (Node.js 18+ also supported)

## Upgrading from v1.x (multilingual-e5-small)

**IMPORTANT**: Version 2.0+ uses EmbeddingGemma with 768-dimensional embeddings (vs 384 in v1.x).
The database must be recreated as vector dimensions are incompatible.

### Migration Steps

```bash
# 1. Backup existing database (optional)
cp ~/.config/conversation-memory/conversations.db \
   ~/.config/conversation-memory/conversations.db.backup

# 2. Remove old database
rm ~/.config/conversation-memory/conversations.db

# 3. Reinstall plugin dependencies
cd plugins/conversation-memory
bun install

# 4. Rebuild plugin
bun run build

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

## Troubleshooting

### Installation Errors

The plugin automatically installs dependencies on first run. If you encounter errors:

#### Permission Denied (EACCES)

**Symptoms:** Error messages containing "EACCES" or "permission denied"

**Fix:**

```bash
sudo chown -R $(whoami) ~/.npm
```

Then restart Claude Code.

#### Network Errors (ETIMEDOUT, ECONNRESET, ENOTFOUND)

**Symptoms:** Timeout or connection errors during dependency installation

**Fix:**

1. Check your internet connection
2. If behind a corporate firewall, configure npm proxy:

   ```bash
   bun config set proxy http://your-proxy:port
   bun config set https-proxy http://your-proxy:port
   ```

3. Try installing manually:

   ```bash
   cd plugins/conversation-memory
   bun install
   ```

#### Disk Space Full (ENOSPC)

**Symptoms:** Error messages containing "ENOSPC"

**Fix:**

1. Check available disk space: `df -h`
2. Free up space by cleaning bun cache:

   ```bash
   bun pm cache rm
   ```

3. Remove old node_modules:

   ```bash
   cd plugins/conversation-memory
   rm -rf node_modules
   bun install
   ```

### Manual Installation

If automatic installation fails repeatedly, install dependencies manually:

```bash
cd plugins/conversation-memory
bun install
bun run build
```

## Architecture Notes

- **Standalone Plugin**: Complete implementation (not a wrapper)
- **Based on @obra/episodic-memory**: Forked and integrated into Claude Code plugin ecosystem
- **Storage Location**: `~/.config/conversation-memory/` (not `.claude/`)
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
