---
name: remembering-conversations
description: Use when user asks 'how should I...' or 'what's the best approach...' after exploring code, OR when you've tried to solve something and are stuck, OR for unfamiliar workflows, OR when user references past work. Searches conversation history.
version: 1.0.0
---

# Remembering Conversations

**Core principle:** Search before reinventing. Searching costs nothing; reinventing or repeating mistakes costs everything.

## Mandatory: Use the Search Agent

**YOU MUST dispatch the search-conversation agent for any historical search.**

Announce: "Dispatching search agent to find [topic]."

Then use the Task tool with `subagent_type: "search-conversation"`:

```text
Task tool:
  description: "Search past conversations for [topic]"
  prompt: "Search for [specific query or topic]. Focus on [what you're looking for - e.g., decisions, patterns, gotchas, code examples]."
  subagent_type: "search-conversation"
```

The agent will:

1. Search with the `search` tool
2. Read top 2-5 results with the `read` tool
3. Synthesize findings (200-1000 words)
4. Return actionable insights + sources

**Saves 50-100x context vs. loading raw conversations.**

## When to Use

You often get value out of consulting your episodic memory once you understand what you're being asked. Search memory
in these situations:

**After understanding the task:**

- User asks "how should I..." or "what's the best approach..."
- You've explored current codebase and need to make architectural decisions
- User asks for implementation approach after describing what they want

**When you're stuck:**

- You've investigated a problem and can't find the solution
- Facing a complex problem without obvious solution in current code
- Need to follow an unfamiliar workflow or process

**When historical signals are present:**

- User says "last time", "before", "we discussed", "you implemented"
- User asks "why did we...", "what was the reason..."
- User says "do you remember...", "what do we know about..."

**Don't search first:**

- For current codebase structure (use Grep/Read to explore first)
- For info in current conversation
- Before understanding what you're being asked to do

## Direct Tool Access (Discouraged)

You CAN use MCP tools directly, but **DON'T**:

- `mcp__plugin_conversation-memory_conversation-memory__search`
- `mcp__plugin_conversation-memory_conversation-memory__read`

Using these directly wastes your context window. **Always dispatch the agent instead.**

See [MCP-TOOLS.md](./MCP-TOOLS.md) for complete API reference if needed for advanced usage.

## Legacy: How to Search (Discouraged)

**Note:** This section describes direct MCP tool usage, which is discouraged. Use the search-conversation agent instead.

<details>
<summary>Click to expand legacy direct tool usage instructions</summary>

Use the MCP tools provided by conversation-memory plugin:

### Step 1: Search

Use `mcp__plugin_conversation-memory_conversation-memory__search` to find relevant conversations:

```typescript
{
  query: "React Router authentication errors",  // Single concept
  mode: "both",  // "vector" | "text" | "both" (default)
  limit: 10      // Max results (1-50, default: 10)
}
```

**Multi-concept AND search** (finds conversations containing ALL concepts):

```typescript
{
  query: ["authentication", "React Router", "error handling"],
  limit: 10
}
```

**Date filtering:**

```typescript
{
  query: "refactoring patterns",
  after: "2025-09-01",   // YYYY-MM-DD
  before: "2025-10-01"
}
```

### Step 2: Read Details

Use `mcp__plugin_conversation-memory_conversation-memory__read` to view full conversations:

```typescript
{
  path: "/path/from/search/results/conversation.jsonl"
}
```

**Paginate large conversations:**

```typescript
{
  path: "/path/to/conversation.jsonl",
  startLine: 100,  // 1-indexed
  endLine: 200
}
```

## Search Strategy

1. **Start broad**, then narrow:
   - First: `{ query: "authentication" }`
   - Then: `{ query: ["authentication", "JWT", "Express"] }`

2. **Use text mode for exact terms**:
   - IDs, error codes, exact phrases: `{ query: "ERR_AUTH_FAILED", mode: "text" }`

3. **Check top 2-5 results**:
   - Read snippets from search results
   - Use `read` tool for promising conversations
   - Focus on decisions, gotchas, patterns

4. **Synthesize findings**:
   - Summarize key insights (200-1000 words)
   - Include source paths and dates
   - Extract actionable recommendations

## Search Modes

- **`vector`** - Semantic similarity (best for concepts, ideas)
- **`text`** - Exact text matching (best for IDs, codes, exact phrases)
- **`both`** - Combined search (default, recommended for general use)

## Performance Tips

- Search is fast (< 100ms typically)
- Read can be slow for large conversations - use pagination
- Multi-concept search is more precise but may return fewer results
- Text search is case-insensitive

## Example Workflow

```text
User: "How should we implement authentication in the new API?"

1. Understand context:
   - Read current API code
   - Check existing auth patterns

2. Search memory:
   {
     query: ["authentication", "API", "JWT"],
     limit: 10
   }

3. Review top results:
   - Read 2-3 most relevant conversations
   - Note past decisions and rationale

4. Synthesize:
   - Summarize findings
   - Apply to current context
   - Recommend approach with sources
```

## Important Notes

- **Use the agent** - always dispatch search-conversation agent, never use MCP tools directly
- **Search costs nothing** - always check before reinventing
- **Past mistakes are valuable** - learn from failed approaches
- **Context matters** - past decisions may not apply to new situations
- **Sources are essential** - always cite conversation paths and dates
- **Agent saves 50-100x context** - synthesized insights vs. raw conversation data

## Further Reading

- [MCP-TOOLS.md](./MCP-TOOLS.md) - Complete MCP tools API reference (advanced usage only)
- [search-conversation agent](../../agents/search-conversation.md) - Agent implementation details

</details>
