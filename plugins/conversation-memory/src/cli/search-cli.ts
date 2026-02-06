import { searchConversations, formatResults, searchMultipleConcepts, formatMultiConceptResults, SearchOptions } from '../core/search.js';

const args = process.argv.slice(2);

// Parse arguments
let mode: 'vector' | 'text' | 'both' = 'both';
let after: string | undefined;
let before: string | undefined;
let limit = 10;
let projects: string[] | undefined;
const queries: string[] = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: conversation-memory search [OPTIONS] <query>

Search indexed conversations using semantic similarity or exact text matching.

MODES:
  (default)      Combined vector + text search
  --vector       Vector similarity only (semantic)
  --text         Exact string matching only (for git SHAs, error codes)

OPTIONS:
  --after DATE   Only conversations after YYYY-MM-DD
  --before DATE  Only conversations before YYYY-MM-DD
  --project P    Filter to specific project (can be used multiple times)
  --limit N      Max results (default: 10)
  --help, -h     Show this help

EXAMPLES:
  # Semantic search
  conversation-memory search "React Router authentication errors"

  # Find exact string
  conversation-memory search --text "a1b2c3d4e5f6"

  # Time filtering
  conversation-memory search --after 2025-09-01 "refactoring"

  # Project filtering
  conversation-memory search --project my-project "authentication"

  # Multi-project filtering
  conversation-memory search --project my-project --project other-project "API"

  # Combine modes
  conversation-memory search --both "React Router data loading"

  # Multi-concept search (AND - all concepts must match)
  conversation-memory search "React Router" "authentication" "JWT"
`);
    process.exit(0);
  } else if (arg === '--vector') {
    mode = 'vector';
  } else if (arg === '--text') {
    mode = 'text';
  } else if (arg === '--after') {
    after = args[++i];
  } else if (arg === '--before') {
    before = args[++i];
  } else if (arg === '--project') {
    if (!projects) projects = [];
    projects.push(args[++i]);
  } else if (arg === '--limit') {
    limit = parseInt(args[++i]);
  } else {
    // All non-flag args are query terms
    queries.push(arg);
  }
}

if (queries.length === 0) {
  console.error('Usage: conversation-memory search [OPTIONS] <query> [query2] [query3]...');
  console.error('Try: conversation-memory search --help');
  process.exit(1);
}

// Multi-concept search if multiple queries provided
if (queries.length > 1) {
  const options = { limit, after, before, projects };

  searchMultipleConcepts(queries, options)
    .then(async results => {
      console.log(await formatMultiConceptResults(results, queries));
    })
    .catch(error => {
      console.error('Error searching:', error);
      process.exit(1);
    });
} else {
  // Single query - use regular search
  const options: SearchOptions = {
    mode,
    limit,
    after,
    before,
    projects
  };

  searchConversations(queries[0], options)
    .then(async results => {
      console.log(await formatResults(results));
    })
    .catch(error => {
      console.error('Error searching:', error);
      process.exit(1);
    });
}
