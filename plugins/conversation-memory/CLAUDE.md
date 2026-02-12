# conversation-memory

## Purpose

Persistent conversation memory across Claude Code sessions using observation-based semantic search.
Automatically indexes conversations and provides progressive disclosure search through structured observations.

## Key Files

| File | Description |
| ---- | ----------- |
| `src/core/db.v3.ts` | V3 database schema with observations, pending_events, and vector embeddings |
| `src/cli/inject-cli.ts` | SessionStart hook - injects recent observations into session context |
| `src/cli/observe-cli.ts` | PostToolUse/Stop hooks - stores events and extracts observations |
| `src/mcp/server.ts` | MCP server exposing search, get_observations, and read tools |
| `src/core/observations.v3.ts` | Observation extraction and management logic |
| `src/core/search.v3.ts` | Vector and text search across observations |
| `package.json` | Dependencies and scripts (Node.js only - not Bun) |
| `hooks/hooks.json` | Hook configuration for SessionStart, PostToolUse, and Stop events |

## Subdirectories

| Directory | Purpose |
| --------- | ------- |
| `src/core/` | Core library: DB, search, observations, LLM providers, compression |
| `src/cli/` | CLI commands: inject, observe, index, show, stats |
| `src/hooks/` | Hook handlers for SessionStart, PostToolUse, Stop events |
| `src/mcp/` | MCP server implementation |
| `dist/` | Bundled output (cli.mjs, mcp-server.mjs) |
| `scripts/` | Build scripts (esbuild configuration) |
| `tests/` | Test suites |
| `docs/` | Additional documentation |

## For AI Agents

### Working In This Directory

- **CRITICAL**: This plugin ONLY uses Node.js, NOT Bun
  - Run tests with `npm test` (uses vitest)
  - Build with `npm run build` (uses esbuild via node)
  - Dependencies include `better-sqlite3` which is NOT supported by Bun
- Always use `openDatabase()` instead of `initDatabaseV3()` in production code (CLI/hooks)
  - `openDatabase()`: Opens existing DB or creates new one (preserves data)
  - `initDatabaseV3()`: Deletes existing DB and creates fresh one (only for tests)
- After modifying TypeScript files, run `npm run build` to rebuild bundles
- Run `npm run typecheck` to check TypeScript errors
- Test changes with `npm test` before committing

### Architecture Overview

**V3 Database Schema:**

- `pending_events`: Temporary storage for tool events before LLM extraction
- `observations`: Long-term storage for extracted insights
- `vec_observations`: Vector embeddings for semantic search

**Three-Layer Progressive Disclosure:**

1. `search()`: Returns compact observation summaries (~30 tokens each)
2. `get_observations()`: Returns full observation details (~200-500 tokens each)
3. `read()`: Returns raw conversation transcript (~500-2000 tokens)

**Hook Workflow:**

1. **SessionStart** (`inject-cli.ts`): Queries recent observations and injects into session context
2. **PostToolUse** (`observe-cli.ts`): Compresses and stores tool events in `pending_events`
3. **Stop** (`observe-cli.ts --summarize`): Batch extracts observations from `pending_events` using LLM

### Common Patterns

**Database Operations:**

```typescript
// Production (CLI/hooks): Preserve existing data
const db = openDatabase();

// Tests only: Clean slate
const db = initDatabaseV3();
```

**LLM Configuration:**

- Requires `~/.config/conversation-memory/config.json`
- Supported providers: `gemini`, `zai`
- If no config found, indexing works but summarization is skipped

**Storage Locations:**

- Database: `~/.config/conversation-memory/conversation-index/conversations.db`
- Archive: `~/.config/conversation-memory/conversation-archive/`
- Config: `~/.config/conversation-memory/config.json`
- Logs: `~/.config/conversation-memory/logs/`

### Testing Requirements

- Run `npm test` before committing (NOT `bun test`)
- Ensure all tests pass (750 tests total)
- Integration tests use in-memory SQLite (`:memory:`)
- Mock LLM providers in tests to avoid API calls

### Common Pitfalls

❌ **Do NOT**:

- Use `bun test` or `bun run` commands (better-sqlite3 not supported)
- Call `initDatabaseV3()` in production code (wipes database)
- Use MCP tools directly (waste context - use search-conversation agent instead)
- Modify DB schema without migration strategy

✅ **Do**:

- Use `npm test` and `npm run build` (Node.js only)
- Call `openDatabase()` in CLI/hooks (preserves data)
- Use search-conversation agent for queries (saves 50-100x context)
- Update tests when changing DB schema

## Dependencies

### External

- **Node.js** (>= 18.0.0) - Required runtime (NOT Bun)
- **better-sqlite3** (^9.6.0) - SQLite database with native bindings
- **sqlite-vec** (^0.1.6) - Vector similarity search extension
- **@huggingface/transformers** (^3.8.1) - EmbeddingGemma for embeddings
- **@google/generative-ai** (^0.24.1) - Gemini API for summarization
- **@modelcontextprotocol/sdk** (^1.0.4) - MCP protocol implementation
- **zod** (^3.22.4) - Schema validation
- **marked** (^17.0.1) - Markdown parsing

### Development Tools

- **vitest** (^3.0.0) - Test runner (uses Node.js)
- **esbuild** (^0.25.0) - Bundler
- **typescript** (^5.3.3) - Type checking

## Migration from v2 to v3

**IMPORTANT:** v3 uses a completely different database schema that is **incompatible** with v2.

### Schema Changes

**v2 Schema (deprecated):**
- `exchanges` table - Exchange-based search
- `vec_exchanges` table - Vector embeddings for exchanges
- `session_summaries` table - Session-level summaries

**v3 Schema (current):**
- `observations` table - Simplified observation model (title + content)
- `vec_observations` table - Vector embeddings for observations
- `pending_events` table - Temporary event storage before LLM extraction

### Fresh Install Required

If upgrading from v2, you must start with a fresh database:

```bash
# 1. Backup existing database (optional)
cp ~/.config/conversation-memory/conversation-index/conversations.db \
   ~/.config/conversation-memory/conversation-index/conversations.v2.backup

# 2. Remove v2 database
rm ~/.config/conversation-memory/conversation-index/conversations.db

# 3. Rebuild plugin
cd plugins/conversation-memory
npm install
npm run build

# 4. Database will be recreated automatically on next session
# SessionStart hook will initialize v3 schema
```

### Data Migration

**There is no automated migration from v2 to v3.** The schema changes are too significant.

If you need historical data:
- Archive v2 database for reference
- Start fresh with v3
- v3 will re-index new conversations going forward

### Detecting Schema Version

The database will automatically detect and reject v2 schemas with a clear error message.

**Symptom of v2 database used with v3 code:**
```
Error: Database schema mismatch: v2 database detected.
```

**Solution:** Remove old database and let v3 create fresh schema.

<!-- MANUAL: Project-specific notes below this line are preserved -->
