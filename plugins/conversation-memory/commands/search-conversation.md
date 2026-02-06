---
name: search-conversation
description: Search through past conversations using semantic search
argument-hint: [<query>]
---

You are helping the user search through their conversation history using the conversation-memory plugin.

## How This Command Works

This command uses the conversation-memory MCP tools to search past Claude Code sessions:

1. **Semantic Search**: Uses vector similarity to find conversations related to the query
2. **Full-Text Search**: Uses text matching for precise keyword searches
3. **Context Retrieval**: Can read full conversations after finding relevant matches

## Search Strategy

When the user provides a query:

1. **Use the search tool first**:
   - Call `mcp__plugin_conversation-memory_conversation-memory__search` with the user's query
   - The search returns ranked results with:
     - Project context
     - Date/time
     - Matching snippets
     - File paths to full conversations

2. **Present results clearly**:
   - Show the most relevant matches (default: top 10)
   - Include date, project, and relevance score
   - Summarize what was discussed in each match

3. **Offer to read full context**:
   - If user wants more detail, use `mcp__plugin_conversation-memory_conversation-memory__read`
   - Read the specific conversation file to get complete context

## Query Tips

Help the user formulate effective queries:

- **Single concepts**: "authentication", "database migration", "bug fix"
- **Multiple related concepts** (array format): ["redis", "caching", "performance"]
- **Specific technical terms**: "JWT token", "React hooks", "Docker compose"
- **Date filtering**: Use `before` and `after` parameters (YYYY-MM-DD format)

## Example Usage

```text
User: /search-conversation authentication bug
Bot: Searching for conversations about "authentication bug"...
     Found 3 relevant conversations:

     1. [2026-01-15] Fix JWT token validation error (95% match)
        - Fixed bug in token expiry checking
        - Added unit tests for edge cases

     2. [2026-01-10] Implement OAuth2 login (78% match)
        - Added OAuth2 authentication flow
        - Configured callback handlers

     Would you like me to read the full context of any of these?
```

## Important Notes

- Search is **semantic** - it understands concepts, not just exact keywords
- Results include both **your messages and Claude's responses**
- The search covers **all indexed sessions** in the conversation-memory database
- Use the `limit` parameter to control result count (default: 10, max: 50)
- Use `mode` parameter to choose search type:
  - `both` (default): Vector + text search
  - `vector`: Semantic similarity only
  - `text`: Full-text search only

## Response Format Options

- `markdown` (default): Human-readable format
- `json`: Structured data for programmatic use

Always use markdown format unless the user specifically requests JSON.
