---
name: search-conversation
description: Search through past conversations using observations (structured insights)
argument-hint: [<query>]
---

You are helping the user search through their conversation history using the conversation-memory plugin's **observation-based search system**.

## How This Command Works

This command uses the conversation-memory MCP tools to search past Claude Code sessions using a **3-layer progressive disclosure pattern**:

1. **Layer 1: search()** - Returns compact observations (~30t each)
   - Fast discovery of relevant insights from past sessions
   - Observations are structured: id, project, date, type, title, facts

2. **Layer 2: get_observations()** - Full observation details (~200-500t each)
   - Complete context: narrative, concepts, files, decisions
   - Enough detail to understand what happened and why

3. **Layer 3: read()** - Raw conversation transcript (~500-2000t)
   - Full dialogue when you need the complete rationale
   - Use only when layers 1-2 don't provide enough context

**Key benefit:** Most searches are satisfied with layers 1-2, saving 50-100x context vs loading raw conversations.

## Search Strategy

When the user provides a query:

1. **Use the search tool first (Layer 1)**:
   - Call `mcp__plugin_conversation-memory_conversation-memory__search` with the user's query
   - The search returns compact observations with:
     - Observation ID
     - Project context
     - Date/time
     - Type (decision, bug-fix, pattern, etc.)
     - Title and facts
     - Relevance score

2. **Present results clearly**:
   - Show the most relevant matches (default: top 10)
   - Include date, project, type, and relevance score
   - Summarize key facts from each observation

3. **Offer full details (Layer 2)**:
   - If user wants more detail, use `mcp__plugin_conversation-memory_conversation-memory__get_observations`
   - Provide observation IDs from the search results
   - Get complete narrative, concepts, and files

4. **Offer raw transcript (Layer 3 - rarely needed)**:
   - Only if layers 1-2 don't provide enough context
   - Use `mcp__plugin_conversation-memory_conversation-memory__read`
   - Read the specific conversation file for complete dialogue

## Query Tips

Help the user formulate effective queries:

- **Single concepts**: "authentication", "database migration", "bug fix"
  - Uses observation-based search (preferred)
  - Returns structured insights with facts and concepts

- **Multiple related concepts** (array format): ["redis", "caching", "performance"]
  - Uses legacy exchange-based search
  - Returns conversations containing ALL concepts
  - Less structured than observations

- **Advanced filters** (single-concept only):
  - `types`: Filter by observation type (decision, bug-fix, pattern, etc.)
  - `concepts`: Filter by tagged concepts
  - `files`: Filter by files mentioned or modified
  - `projects`: Filter by project name

- **Specific technical terms**: "JWT token", "React hooks", "Docker compose"
- **Date filtering**: Use `before` and `after` parameters (YYYY-MM-DD format)

## Example Usage

```text
User: /search-conversation authentication bug
Bot: Searching for observations about "authentication bug"...
     Found 3 relevant observations:

     1. [my-api, 2026-01-15] Fix JWT token validation error (95% match)
        Type: bug-fix
        Facts:
        - Token expiry checking was off by one hour
        - Added unit tests for edge cases around midnight

     2. [my-api, 2026-01-10] Implement OAuth2 login (78% match)
        Type: decision
        Facts:
        - Chose OAuth2 over JWT for external integrations
        - Configured callback handlers for success/failure

     3. [auth-service, 2025-12-20] Session timeout configuration (65% match)
        Type: pattern
        Facts:
        - Implemented configurable session timeout
        - Default: 30 minutes with refresh token

     Would you like me to get full details for any of these observations?
```

## Important Notes

- Search uses **observations** (structured insights) for single-concept queries
- Observations provide **compact, relevant facts** without loading entire conversations
- Multi-concept search uses **legacy exchange-based system** (less structured)
- The search covers **all indexed sessions** in the conversation-memory database
- Use the `limit` parameter to control result count (default: 10, max: 50)
- Use `mode` parameter to choose search type:
  - `both` (default): Vector + text search
  - `vector`: Semantic similarity only
  - `text`: Full-text search only
- **Progressive disclosure saves context**: Most searches need only layers 1-2

## Response Format Options

- `markdown` (default): Human-readable format
- `json`: Structured data for programmatic use

Always use markdown format unless the user specifically requests JSON.
