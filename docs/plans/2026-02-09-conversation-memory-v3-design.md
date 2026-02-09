# conversation-memory v3: Observer Redesign

## Problem

Current conversation-memory plugin wastes tokens and is hard to maintain:

1. **Observer daemon** polls DB every 1s, calls Gemini LLM per tool event (~$0.01/event)
2. **Dual storage systems**: exchanges (legacy) + observations (new) with overlapping functionality
3. **Complex observation schema**: 10+ fields (type, title, subtitle, narrative, facts, concepts, files_read, files_modified, etc.)
4. **Injection bloat**: 7 days of observations injected every session (~900 tokens, often irrelevant)
5. **LLM required**: Plugin doesn't function without Gemini API key configured

## Research Summary

Analyzed claude-mem, SimpleMem, Mem0, LangMem, and Zep. Key findings:

- **Per-event LLM calls are an industry anti-pattern.** All major systems (SimpleMem, Mem0, Zep) batch or defer LLM processing.
- **Mem0's ADD/UPDATE/DELETE pattern** is the standard for memory evolution, but entirely LLM-driven. No system uses algorithmic dedup alone.
- **SimpleMem's Stage 2 (Online Synthesis)** is not implemented in practice - relies on LLM prompting, not algorithms.
- **LangMem's "subconscious memory formation"** = background thread + debouncing. Simple pattern, effective.
- **Industry consensus**: embedding similarity (cosine > 0.9) catches 80% of duplicates. LLM needed only for edge cases.

## Design

### Architecture

```
[Claude Code Session]
       |
       +-- PostToolUse Hook (sync, fast, NO LLM)
       |    -> Rule-based observation creation
       |    -> Embedding-based dedup (cosine > 0.9)
       |    -> Store in observations table
       |
       +-- Stop Hook (async)
       |    -> LLM batch: consolidate session observations
       |    -> Generate summary observations
       |    -> Supersede originals (soft invalidation)
       |
       +-- SessionStart Hook (sync, fast)
            -> Inject recent observations (token budget)
```

### Observation Schema (Flat Text)

```sql
CREATE TABLE observations (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  project TEXT NOT NULL,
  session_id TEXT,
  timestamp INTEGER NOT NULL,
  tool_name TEXT,
  files TEXT,                    -- JSON array, nullable
  superseded_by INTEGER,         -- soft invalidation (never delete)
  created_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE vec_observations USING vec0(
  embedding float[768]
);

CREATE VIRTUAL TABLE observations_fts USING fts5(content);
```

Single `content` field replaces type, title, subtitle, narrative, facts, concepts, files_read, files_modified, correlation_id.

### Rule-Based Observation Creation (PostToolUse)

No LLM. Extract structured content from tool input/output:

```
Read  -> "Read /src/auth.ts"
Edit  -> "Edited /src/auth.ts: validateToken -> validateJWT"
Write -> "Created /src/auth.ts"
Bash  -> "Ran `npm test` -> OK" or "Ran `npm test` -> FAILED: error msg"
Grep  -> "Searched for 'pattern' in /src"
WebSearch -> "Searched: query text"
WebFetch  -> "Fetched example.com"
```

Skipped tools (low value): Glob, LSP, TodoWrite, TaskCreate, TaskUpdate, TaskList, TaskGet, AskUserQuestion, EnterPlanMode, ExitPlanMode, NotebookEdit, Skill.

### Deduplication (Embedding Similarity)

On each new observation:
1. Embed content with EmbeddingGemma
2. Search vec_observations for cosine > 0.9 within same session
3. If duplicate found, skip insertion

### LLM Batch Consolidation (Stop Hook)

On session end:
1. Collect all observations from this session
2. If < 3 observations, skip (too short)
3. Send to Gemini with consolidation prompt
4. Store consolidated observations
5. Mark originals with `superseded_by` pointing to consolidated obs

Consolidation prompt asks LLM to:
- Group related actions (read -> edit -> test cycles)
- Produce 1-3 self-contained sentences
- Focus on WHAT was done and WHY

**LLM is optional.** Without Gemini config, consolidation is skipped. Rule-based observations still work.

### Injection (SessionStart)

Token-budgeted injection:

```
Config:
  maxObservations: 20
  maxTokens: 500
  recencyDays: 7
  projectOnly: true

Output format:
  # [project-name] recent context (conversation-memory)

  - Consolidated observation 1
  - Consolidated observation 2
  - ...
```

Excludes `superseded_by IS NOT NULL` observations. Stops when token budget reached.

### MCP Tools

Three tools, simplified:

**search**: Single query string only (no array/multi-concept).
- Params: query, mode (vector/text/both), limit, after, before, projects, files
- Returns: compact observations with id, content, project, timestamp

**get_observations**: Full details by ID array.
- Params: ids (1-20)
- Returns: complete observation objects

**read**: Raw conversation from DB or JSONL.
- Params: path, startLine, endLine
- Returns: markdown conversation transcript

## Legacy Removal (Clean Slate)

### Delete

```
Code:
  src/core/parser.ts           (JSONL parsing for exchanges)
  src/core/sync.ts             (conversation file sync)
  src/core/tool-compress.ts    (tool summarization for exchanges)
  src/core/observer.ts         (observer daemon)
  src/core/observation-prompt.ts (observer LLM prompts)
  src/core/llm/round-robin-provider.ts

DB tables:
  exchanges, vec_exchanges, tool_calls, pending_events
  observations_fts (rebuild with new schema)
  session_summaries_fts

MCP search:
  Multi-concept (array query) search path
  Exchange-based search logic
```

### Keep (Modified)

```
src/core/db.ts               (new schema)
src/core/embeddings.ts        (EmbeddingGemma, unchanged)
src/core/observations.ts      (simplified CRUD)
src/core/search.ts            (observation-only)
src/core/inject.ts            (token budget)
src/core/llm/gemini-provider.ts (for Stop Hook batch)
src/core/llm/config.ts        (simplified)
src/mcp/server.ts             (3 tools, simplified)
hooks/hooks.json              (PostToolUse, Stop, SessionStart)
```

### Migration Strategy

No migration. Delete existing DB file. New schema created on first run. Existing observation data is abandoned.

## Token Impact

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| PostToolUse (per event) | ~500t Gemini call | 0t (rule-based) | 100% |
| Injection (per session) | ~900t (7 days, all) | ~500t (budgeted) | 44% |
| Session summary | ~2000t (observer) | ~1000t (batch, optional) | 50% |
| MCP search | dual-path complexity | single observation path | simpler |

## Dependencies

### Removed
- Observer daemon process management (PID files, signal handling, polling)
- Round-robin LLM provider
- JSONL parser
- Conversation file sync

### Unchanged
- `@huggingface/transformers` (EmbeddingGemma)
- `better-sqlite3` + `sqlite-vec`
- `@modelcontextprotocol/sdk`
- `@google/generative-ai` (optional, for Stop Hook)
- `zod`

### Potentially Removable
- `marked` (unused in current code)
