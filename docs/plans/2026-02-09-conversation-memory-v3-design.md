# conversation-memory v3: Observer Redesign

## Problem

Current conversation-memory plugin wastes tokens and is hard to maintain:

1. **Observer daemon** polls DB every 1s, calls Gemini LLM per tool event (~$0.01/event)
2. **Dual storage systems**: exchanges (legacy) + observations (new) with overlapping functionality
3. **Complex observation schema**: 10+ fields (type, title, subtitle, narrative, facts, concepts, files_read, files_modified, etc.)
4. **Injection bloat**: 7 days of observations injected every session (~900 tokens, often irrelevant)

## Research Summary

Analyzed claude-mem, SimpleMem, Mem0, LangMem, and Zep. Key findings:

- **claude-mem**: per-observation LLM extraction (title, narrative, facts, concepts). No dedup (open feature request).
- **SimpleMem**: batches 20-40 events into windows, single LLM call per window. LLM decides what's worth extracting (empty array = low value window). Previous batch's last 3 observations provided as context to avoid duplication.
- **Mem0**: fire-and-forget queue with async batch extraction. ADD/UPDATE/DELETE/NOOP decisions by LLM.
- **Industry consensus**: per-event LLM is an anti-pattern. All production systems batch or defer.

## Design

### Architecture

```
[Claude Code Session]
       |
       +-- PostToolUse Hook (async, NO LLM)
       |    -> Rule-based compression of tool data
       |    -> Store in pending_events table
       |
       +-- Stop Hook (async, LLM batch)
       |    -> Collect pending_events from this session
       |    -> Batch into groups of 10-20 events
       |    -> Gemini call per batch: extract title + content
       |    -> Store observations + embeddings
       |
       +-- SessionStart Hook (sync, fast)
            -> Inject recent observations (token budget)
```

Three hooks. No daemon.

### Database Schema

```sql
CREATE TABLE pending_events (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  project TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  compressed TEXT NOT NULL,       -- rule-based compressed tool data
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE observations (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  project TEXT NOT NULL,
  session_id TEXT,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE vec_observations USING vec0(
  embedding float[768]
);

CREATE VIRTUAL TABLE observations_fts USING fts5(title, content);
```

### PostToolUse Hook (async, NO LLM)

Rule-based compression of tool data, stored in pending_events:

```
Read  -> "Read /src/auth.ts (245 lines)"
Edit  -> "Edited /src/auth.ts: old_string → new_string"
Write -> "Created /src/auth.ts (120 lines)"
Bash  -> "Ran `npm test` → exit 0" or "Ran `npm test` → exit 1: error summary"
Grep  -> "Searched 'pattern' in /src → 5 matches"
WebSearch -> "Searched: query text"
WebFetch  -> "Fetched example.com"
```

Skipped tools (low value): Glob, LSP, TodoWrite, TaskCreate, TaskUpdate, TaskList, TaskGet, AskUserQuestion, EnterPlanMode, ExitPlanMode, NotebookEdit, Skill.

### Stop Hook (async, LLM batch)

On session end:

1. Collect all pending_events for this session
2. If < 3 events, skip (too short to be useful)
3. Group into batches of 10-20 events
4. For each batch, call Gemini with:
   - The compressed event data
   - Previous batch's last 3 observations (context, avoids duplication)
   - Extraction prompt: produce title + content for each meaningful observation
   - LLM may return empty array for low-value batches
5. Store observations with embeddings

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

  - observation title: content
  - ...
```

Stops when token budget reached.

### MCP Tools

Three tools:

**search**: Single query string.
- Params: query, mode (vector/text/both), limit, after, before, projects, files
- Returns: compact observations with id, title, project, timestamp

**get_observations**: Full details by ID array.
- Params: ids (1-20)
- Returns: complete observation objects (title + content)

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
  exchanges, vec_exchanges, tool_calls
  session_summaries, session_summaries_fts
  observations_fts (rebuild with new schema)

MCP search:
  Multi-concept (array query) search path
  Exchange-based search logic
```

### Keep (Modified)

```
src/core/db.ts               (new schema: pending_events + observations)
src/core/embeddings.ts        (EmbeddingGemma, unchanged)
src/core/observations.ts      (simplified CRUD)
src/core/search.ts            (observation-only)
src/core/inject.ts            (token budget)
src/core/compress.ts          (NEW: rule-based tool data compression)
src/core/llm/gemini-provider.ts (for Stop Hook batch extraction)
src/core/llm/config.ts        (simplified)
src/mcp/server.ts             (3 tools, simplified)
hooks/hooks.json              (PostToolUse, Stop, SessionStart)
```

### Migration Strategy

No migration. Delete existing DB file. New schema created on first run.

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
- `@google/generative-ai` (for Stop Hook batch extraction)
- `zod`

### Potentially Removable
- `marked` (unused in current code)
