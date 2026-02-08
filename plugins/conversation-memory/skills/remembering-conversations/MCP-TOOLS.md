# MCP Tools API Reference

This document provides detailed API reference for the conversation-memory MCP tools.

**⚠️ Warning:** Direct MCP tool usage wastes context. Always use the `search-conversation` agent instead.

This reference is for advanced use cases only.

---

## Overview: Progressive Disclosure

The conversation-memory system uses a **3-layer progressive disclosure pattern** to minimize context usage:

1. **search()** - Returns compact observations (~30t each)
2. **get_observations()** - Full observation details (~200-500t each)
3. **read()** - Raw conversation transcript (~500-2000t)

**Most searches are satisfied with layers 1-2.** Only use layer 3 when absolutely necessary.

---

## search

Search conversation history using **observations** (structured insights) for single-concept queries, or **exchanges** (legacy) for multi-concept queries.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string \| string[]` | Yes | - | Single concept or array of 2-5 concepts for AND search |
| `mode` | `"vector" \| "text" \| "both"` | No | `"both"` | Search mode (semantic, exact text, or combined) |
| `limit` | `number` | No | `10` | Max results (1-50) |
| `after` | `string` | No | - | Filter results after this date (YYYY-MM-DD) |
| `before` | `string` | No | - | Filter results before this date (YYYY-MM-DD) |
| `projects` | `string[]` | No | - | Filter by project names |
| `types` | `string[]` | No | - | Filter by observation types (single-concept only) |
| `concepts` | `string[]` | No | - | Filter by tagged concepts (single-concept only) |
| `files` | `string[]` | No | - | Filter by files mentioned/modified (single-concept only) |
| `response_format` | `"markdown" \| "json"` | No | `"markdown"` | Output format |

### Single Concept Search (Observations)

```json
{
  "query": "authentication patterns"
}
```

Returns **observations** semantically similar to "authentication patterns":

```markdown
## Search Results (10 observations)

### 1. [my-api] - 2025-12-01
**ID:** obs-abc123
**Type:** decision
**Score:** 0.85

**Title:** Implement JWT authentication middleware
**Facts:**
- Chose JWT over session-based auth for statelessness
- Implemented refresh token rotation for security
- Added rate limiting to prevent brute force

---

### 2. [auth-service] - 2025-11-15
**ID:** obs-def456
**Type:** pattern
**Score:** 0.78

**Title:** OAuth2 integration pattern
**Facts:**
- Standardized OAuth2 flow across services
- Created shared auth library
...
```

### Advanced Filtering (Single-Concept Only)

```json
{
  "query": "authentication",
  "types": ["decision", "bug-fix"],
  "concepts": ["JWT", "middleware"],
  "files": ["auth.ts"],
  "projects": ["my-api"]
}
```

Returns observations matching all specified filters.

### Multi-Concept AND Search (Legacy)

**Note:** Multi-concept search uses the legacy exchange-based system, not observations.

```json
{
  "query": ["React Router", "authentication", "JWT"]
}
```

Returns conversations containing ALL three concepts (exchanges, not observations).

**Consider using single-concept search with filters instead:**
```json
{
  "query": "React Router authentication",
  "concepts": ["JWT"]
}
```

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

## get_observations

Get full observation details (Layer 2 of progressive disclosure).

### get_observations() Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `ids` | `string[]` | Yes | - | Array of observation IDs (1-20) |

### Basic Usage

```json
{
  "ids": ["obs-abc123", "obs-def456", "obs-ghi789"]
}
```

Returns full observation details including narrative, facts, concepts, and files.

### get_observations() Response Format

```markdown
Retrieved 3 observations:

## [my-api, 2025-12-01 14:30] - decision: Implement JWT authentication middleware

**Chose JWT over session-based auth for API scalability**

After evaluating both options, decided on JWT because:
- Stateless nature fits microservices architecture
- Easier to scale horizontally without session replication
- Built-in expiry handling reduces security risks

**Facts:**
- Implemented refresh token rotation for security
- Added rate limiting to prevent brute force attacks
- Used HS256 for simplicity (single service)

**Concepts:** `JWT`, `middleware`, `refresh-token`, `rate-limiting`

**Files:** `auth.ts`, `middleware/jwt.ts`

---

## [auth-service, 2025-11-15 09:15] - pattern: OAuth2 integration pattern
...
```

### get_observations() Error Handling

**Invalid IDs:**

- Returns error if IDs don't exist
- Verify IDs from search results

**Too many IDs:**

- Maximum 20 observations per request
- Split into multiple requests if needed

---

## read

Read full conversation transcript (Layer 3 of progressive disclosure).

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
- Vector search scales well to 10K+ observations

### get_observations Performance

- Typical: < 50ms
- Direct database lookup by ID
- Very efficient for 1-20 observations

### Read Performance

- Small conversations (< 50 exchanges): instant
- Large conversations (> 100 exchanges): 100-500ms
- **Use pagination for conversations > 200 exchanges**

### Context Usage (Progressive Disclosure)

**Layer 1: search()**
- Returns compact observations: ~30 tokens each
- 10 observations = ~300 tokens

**Layer 2: get_observations()**
- Full observation details: ~200-500 tokens each
- 5 observations = ~1,000-2,500 tokens

**Layer 3: read()**
- Raw conversation: ~500-2,000 tokens each
- Use only when absolutely necessary

**Agent-mediated:**
- Agent synthesis: 1,000-2,000 tokens
- **50-100x context savings vs raw conversations** ✅

---

## Advanced Patterns

### Progressive Disclosure (Recommended)

```typescript
// Layer 1: Search for observations
{ query: "authentication" }
// Returns: Compact observations (~30t each)

// Layer 2: Get full details
{ ids: ["obs-abc123", "obs-def456"] }
// Returns: Full observations (~200-500t each)

// Layer 3: Read raw conversation (only if needed)
{ path: "/path/to/conversation.jsonl" }
// Returns: Full transcript (~500-2000t)
```

### Progressive Refinement

```typescript
// Step 1: Broad search
{ query: "authentication" }

// Step 2: Filter by type
{ query: "authentication", types: ["decision", "bug-fix"] }

// Step 3: Filter by concepts
{ query: "authentication", concepts: ["JWT", "middleware"] }
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
| Context usage | 50,000+ tokens (raw) | 1,000-2,000 tokens (synthesized) |
| Progressive disclosure | Manual (search → get_observations → read) | Automatic |
| Quality | Raw data dump | Curated insights |
| Sources | Must track manually | Auto-included |
| Workflow | Multi-step | Single dispatch |
| Observation system | Manual navigation | Automatic layer selection |

**The agent does everything automatically and uses 50-100x less context.**

---

## Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "No observations found" | No matches | Try broader query |
| "Query must be string or array" | Invalid type | Use string or string[] |
| "Query array must have 2-5 items" | Wrong array size | Add/remove concepts |
| "Invalid date format" | Wrong format | Use YYYY-MM-DD |
| "Invalid observation ID" | Bad ID | Verify ID from search results |
| "File not found" | Bad path | Verify path from search |
| "Invalid line range" | Bad startLine/endLine | Check line numbers |

---

## See Also

- [SKILL.md](./SKILL.md) - High-level usage guide
- [README.md](../../README.md) - Plugin documentation
- [search-conversation agent](../../agents/search-conversation.md) - Recommended workflow
