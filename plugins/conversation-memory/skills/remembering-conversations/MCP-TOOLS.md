# MCP Tools API Reference

This document provides detailed API reference for the conversation-memory MCP tools.

**⚠️ Warning:** Direct MCP tool usage wastes context. Always use the `search-conversation` agent instead.

This reference is for advanced use cases only.

---

## search

Search conversation history using semantic similarity and/or full-text search.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string \| string[]` | Yes | - | Single concept or array of 2-5 concepts for AND search |
| `mode` | `"vector" \| "text" \| "both"` | No | `"both"` | Search mode (semantic, exact text, or combined) |
| `limit` | `number` | No | `10` | Max results (1-50) |
| `after` | `string` | No | - | Filter results after this date (YYYY-MM-DD) |
| `before` | `string` | No | - | Filter results before this date (YYYY-MM-DD) |
| `response_format` | `"markdown" \| "json"` | No | `"markdown"` | Output format |

### Single Concept Search

```json
{
  "query": "authentication patterns"
}
```

Returns conversations semantically similar to "authentication patterns".

### Multi-Concept AND Search

```json
{
  "query": ["React Router", "authentication", "JWT"]
}
```

Returns only conversations containing ALL three concepts.

### Date Filtering

```json
{
  "query": "refactoring",
  "after": "2025-09-01",
  "before": "2025-10-01"
}
```

### Search Modes

**`vector` (semantic):**

- Uses 768-dimensional embeddings (EmbeddingGemma)
- Best for concepts, ideas, similar discussions
- Understands synonyms and related terms

**`text` (exact matching):**

- Uses SQLite FTS5 full-text search
- Best for IDs, error codes, exact phrases
- Case-insensitive

**`both` (default):**

- Combines semantic and exact matching
- Recommended for general use
- Returns diverse results

### Response Format

**Markdown (default):**

```markdown
## Search Results (10 conversations)

### 1. [Project Name] - 2025-12-01
**Path:** `/path/to/conversation.jsonl`
**Score:** 0.85

Summary: User implemented authentication using JWT...

---

### 2. [Project Name] - 2025-11-15
...
```

**JSON:**

```json
{
  "results": [
    {
      "path": "/path/to/conversation.jsonl",
      "project": "my-project",
      "date": "2025-12-01",
      "score": 0.85,
      "summary": "User implemented authentication...",
      "snippet": "Context around match..."
    }
  ],
  "total": 10
}
```

### Error Handling

**No results:**

- Returns "No conversations found" message
- Try broader query or remove date filters

**Invalid date format:**

- Returns error message
- Use YYYY-MM-DD format

**Query too short:**

- Single string must be ≥2 characters
- Array must have 2-5 concepts

---

## read

Read full conversation transcript.

### read() Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `path` | `string` | Yes | - | Path from search results |
| `startLine` | `number` | No | `1` | Starting line (1-indexed) |
| `endLine` | `number` | No | - | Ending line (omit for all) |

### Basic Usage

```json
{
  "path": "/Users/user/.claude/conversation-memory/conversation-archive/my-project/session-abc123.jsonl"
}
```

Returns entire conversation in markdown format.

### Pagination (Large Conversations)

```json
{
  "path": "/path/to/conversation.jsonl",
  "startLine": 100,
  "endLine": 200
}
```

Returns lines 100-200 only.

### read() Response Format

```markdown
# Conversation: session-abc123
# Project: my-project
# Date: 2025-12-01

## Exchange 1

**User:**
How should I implement authentication?

**Assistant:**
Let me search for past authentication patterns...

---

## Exchange 2

**User:**
What about JWT tokens?

**Assistant:**
Based on previous discussions...
```

### read() Error Handling

**File not found:**

- Returns error if path doesn't exist
- Verify path from search results

**Invalid line range:**

- startLine must be ≥1
- endLine must be ≥startLine
- Returns error if out of range

---

## Performance Notes

### Search Performance

- Typical: < 100ms
- First query may take longer (index warmup)
- Vector search scales well to 10K+ conversations

### Read Performance

- Small conversations (< 50 exchanges): instant
- Large conversations (> 100 exchanges): 100-500ms
- **Use pagination for conversations > 200 exchanges**

### Context Usage

**Direct tool usage:**

- Search: ~500 tokens
- Read (100 exchanges): ~50,000 tokens 🚨

**Agent-mediated:**

- Agent synthesis: 1,000-2,000 tokens
- **50-100x context savings** ✅

---

## Advanced Patterns

### Progressive Refinement

```typescript
// Step 1: Broad search
{ query: "authentication" }

// Step 2: Narrow down
{ query: ["authentication", "JWT"] }

// Step 3: Specific framework
{ query: ["authentication", "JWT", "Express"] }
```

### Temporal Analysis

```typescript
// Recent discussions
{
  query: "API design",
  after: "2025-10-01"
}

// Historical decisions
{
  query: "database migration",
  before: "2025-06-01"
}

// Specific period
{
  query: "refactoring",
  after: "2025-09-01",
  before: "2025-10-01"
}
```

### Exact Match + Context

```typescript
// Find exact error code with context
{
  query: "ERR_AUTH_FAILED",
  mode: "text"
}

// Then read surrounding conversation
{
  path: "/path/from/results.jsonl",
  startLine: match_line - 10,
  endLine: match_line + 10
}
```

---

## Why Use the Agent Instead?

| Aspect | Direct Tools | search-conversation Agent |
|--------|--------------|---------------------------|
| Context usage | 50,000+ tokens | 1,000-2,000 tokens |
| Manual work | Search → Read → Synthesize | Fully automated |
| Quality | Raw data dump | Curated insights |
| Sources | Must track manually | Auto-included |
| Workflow | Multi-step | Single dispatch |

**The agent does everything automatically and uses 50-100x less context.**

---

## Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "No conversations found" | No matches | Try broader query |
| "Query must be string or array" | Invalid type | Use string or string[] |
| "Query array must have 2-5 items" | Wrong array size | Add/remove concepts |
| "Invalid date format" | Wrong format | Use YYYY-MM-DD |
| "File not found" | Bad path | Verify path from search |
| "Invalid line range" | Bad startLine/endLine | Check line numbers |

---

## See Also

- [SKILL.md](./SKILL.md) - High-level usage guide
- [README.md](../../README.md) - Plugin documentation
- [search-conversation agent](../../agents/search-conversation.md) - Recommended workflow
