# Conversation Memory Cleanup - Phase 1 Implementation Plan

**Date:** 2026-02-12
**Phase:** 1 of 3 (Critical Fixes)
**Estimated Time:** 1 hour
**Risk Level:** Very Low

## Overview

Phase 1 removes obvious dead code and fixes misleading documentation. All changes are deletions or documentation updates with no functional behavior changes.

## Tasks

### Task 1: Remove zhipu-ai Legacy References (15 min)

**Files to modify:**
1. `plugins/conversation-memory/CLAUDE.md`
2. `plugins/conversation-memory/scripts/build.mjs`

**Changes:**

#### CLAUDE.md (2 edits)

**Edit 1 - Line 84:**
```diff
-**Supported providers:** `gemini`, `zhipu-ai`
+**Supported providers:** `gemini`, `zai`
```

**Edit 2 - Line 126:**
```diff
 - **@google/generative-ai** (^0.24.1) - Gemini API for summarization
-- **zhipuai-sdk-nodejs-v4** (^0.1.12) - Zhipu AI API for summarization
 - **@modelcontextprotocol/sdk** (^1.0.4) - MCP protocol implementation
```

#### build.mjs (1 edit)

**Line 24 - Remove from external array:**
```diff
   external: [
     '@modelcontextprotocol/sdk',
     '@google/generative-ai',
-    'zhipuai-sdk-nodejs-v4',
     'better-sqlite3',
     'sqlite-vec',
   ],
```

**Verification:**
```bash
npm run build  # Should complete without errors
```

---

### Task 2: Fix CLI Routing Issues (20 min)

**File:** `plugins/conversation-memory/src/cli/index-cli.ts`

**Changes:**

#### Change 1 - Remove dead 'observe-run' alias

**Line 40-42:**
```diff
     case 'observe':
-    case 'observe-run':
       await import('./observe-cli.js');
       break;
```

#### Change 2 - Fix help text for show/stats commands

**Decision:** Remove show/stats from help text (Option A - simpler approach)

**Lines 5-31 (Help text):**
```diff
 const HELP = `
 conversation-memory CLI

 Usage: conversation-memory <command> [options]

 Commands:
   inject              Inject recent observations into session context
   observe             Store tool use events and extract observations
   index               Index conversation sessions
-  search              Search observations (MCP tool, not CLI)
-  show                Show observation details (MCP tool, not CLI)
-  stats               Show observation statistics (MCP tool, not CLI)
-  read                Read conversation file (MCP tool, not CLI)

 Options:
   --help              Show this help message
   --version           Show version number
+
+MCP Tools (use via Claude Code MCP, not CLI):
+  search              Search observations with filters
+  show                Display observation details
+  stats               Show database statistics
+  read                Read conversation files
 `;
```

**Rationale:**
- These commands are MCP tools, not CLI commands
- No routing exists in index-cli.ts for them
- Separating CLI vs MCP tools in help text improves clarity

**Verification:**
```bash
npm run build
node dist/cli.mjs --help  # Verify help text renders correctly
```

---

### Task 3: Delete Unused XML Type Definitions (15 min)

**File:** `plugins/conversation-memory/src/core/types.ts`

**Changes:**

#### Delete XML parsing types (lines ~115-161)

These types were used in v2 for LLM response parsing but are no longer used in v3:

```diff
-/**
- * SessionSummary XML format (legacy v2 LLM response)
- */
-export interface SessionSummaryXML {
-  skip?: SkipXML;
-  observation?: ObservationXML | ObservationXML[];
-}
-
-export interface SkipXML {
-  reason: string;
-}
-
-export interface ObservationXML {
-  title: string;
-  subtitle?: string;
-  narrative: string;
-  facts?: string | string[];
-  concepts?: string | string[];
-  'files-read'?: string | string[];
-  'files-modified'?: string | string[];
-}
```

**Lines to delete:** Approximately 115-161 (entire XML type definitions block)

**Check for usage:**
```bash
# Verify these types aren't used anywhere
cd plugins/conversation-memory
grep -r "SessionSummaryXML" src/ --exclude-dir=node_modules
grep -r "SkipXML" src/ --exclude-dir=node_modules
grep -r "ObservationXML" src/ --exclude-dir=node_modules
```

Expected result: Only found in types.ts and test files

**Test file updates needed:**
- `src/core/types.test.ts` - Remove tests for deleted types

**Verification:**
```bash
npm run typecheck  # Should pass
npm test          # Update tests as needed
```

---

### Task 4: Delete Unused v2 Search Types (10 min)

**File:** `plugins/conversation-memory/src/core/types.ts`

**Changes:**

#### Delete v2 search result types (lines ~43-66)

These types were used for exchange-based search in v2, now replaced by observation-based search:

```diff
-/**
- * Compact search result for minimal token usage
- */
-export interface CompactSearchResult {
-  id: string;
-  sessionId: string;
-  project: string;
-  timestamp: number;
-  summary: string;
-  score?: number;
-}
-
-/**
- * Multi-concept search result (array query)
- */
-export interface CompactMultiConceptResult {
-  concepts: string[];
-  results: CompactSearchResult[];
-}
```

**Lines to delete:** Approximately 43-66 (search result types)

**Check for usage:**
```bash
grep -r "CompactSearchResult" src/ --exclude-dir=node_modules
grep -r "CompactMultiConceptResult" src/ --exclude-dir=node_modules
```

Expected: Only in types.ts, possibly search.v3.ts comments

**Verification:**
```bash
npm run typecheck
npm test
```

---

## Testing Strategy

### Unit Tests
```bash
cd plugins/conversation-memory
npm test
```

**Expected results:**
- All tests pass OR
- Tests for deleted types fail (expected - will update in next step)

### Type Checking
```bash
npm run typecheck
```

**Expected:** No type errors

### Build Verification
```bash
npm run build
```

**Expected:**
- Build completes successfully
- dist/cli.mjs and dist/mcp-server.mjs generated

### Manual Verification
```bash
# Test CLI help
node dist/cli.mjs --help

# Test MCP server starts (Ctrl+C to exit)
node dist/mcp-server.mjs
```

---

## Rollback Plan

If any issues arise:

```bash
# Rollback all changes
git checkout HEAD -- plugins/conversation-memory/CLAUDE.md
git checkout HEAD -- plugins/conversation-memory/scripts/build.mjs
git checkout HEAD -- plugins/conversation-memory/src/cli/index-cli.ts
git checkout HEAD -- plugins/conversation-memory/src/core/types.ts
```

---

## Success Criteria

- ✅ Zero references to `zhipu-ai` in documentation
- ✅ Build script no longer references zhipuai-sdk
- ✅ CLI help text accurately reflects available commands
- ✅ No dead code path (`observe-run` removed)
- ✅ XML parsing types removed (5 type definitions)
- ✅ v2 search types removed (2 type definitions)
- ✅ All builds complete without errors
- ✅ Type checking passes
- ✅ Tests pass (or known failures for deleted types documented)

---

## Time Breakdown

| Task | Estimated | Buffer |
|------|-----------|--------|
| Remove zhipu-ai refs | 15 min | 5 min |
| Fix CLI routing | 20 min | 10 min |
| Delete XML types | 15 min | 5 min |
| Delete search types | 10 min | 5 min |
| **Total** | **60 min** | **25 min** |

---

## Next Steps After Phase 1

1. Commit changes with conventional commit message
2. Run full test suite one more time
3. Review remaining type definitions in types.ts for Phase 2
4. Document any test failures for Phase 2 cleanup

---

## Notes

- **bun.lock not modified** - Contains zhipuai references but plugin uses Node.js only, so no impact
- **CLI routing decision** - Chose Option A (remove from help) over Option B (implement routing) for simplicity
- **Test updates** - Will be needed for deleted XML types, handled in Phase 2 if needed

---

## Phase 2 Preview

After Phase 1 validation, Phase 2 will:
1. Delete remaining unused types (ToolCall, Observation, CompactObservation, SessionSummary, PendingEvent)
2. Update test files for all deleted types
3. Add v2→v3 migration documentation
4. Verify show.ts utility usage
