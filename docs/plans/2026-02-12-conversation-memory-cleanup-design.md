# Conversation Memory Plugin Cleanup Design

**Date:** 2026-02-12
**Author:** Bot & jito
**Status:** Approved

## Purpose

Clean up legacy code, unused types, and stale documentation in the conversation-memory plugin following the v2→v3 migration and zhipu-ai→zai provider change.

## Background

The conversation-memory plugin has evolved through several iterations:
- **v1**: Original episodic-memory fork with multilingual-e5-small embeddings
- **v2**: Added exchange-based search, zhipu-ai provider, complex observation types
- **v3**: Current - Simplified observation-only architecture, removed zhipu-ai, added zai provider

The v3 migration left behind:
- 10 unused type definitions from v2
- Legacy zhipu-ai references in docs/build config
- Incomplete CLI routing for show/stats commands
- Stale documentation comments

## Problems Identified

Analysis found **25 issues across 8 files** categorized into:

1. **Legacy References** (3 issues) - zhipu-ai mentions in CLAUDE.md, build.mjs, bun.lock
2. **Dead Code** (10 issues) - Unused types in types.ts from v2 schema
3. **CLI Issues** (3 issues) - Dead aliases, incomplete routing, help text mismatch
4. **Documentation** (4 issues) - Stale comments, dependency lists
5. **Architectural Debt** (5 issues) - Wrapper inconsistencies, import patterns

**Estimated cleanup time:** 3-4 hours across 8 files

## Design Approach: Phased Cleanup

### Phase 1: Critical Fixes (1 hour) ✓ APPROVED

**Goal:** Remove obvious dead code and fix misleading documentation

**Changes:**

1. **Remove zhipu-ai legacy references**
   - `CLAUDE.md:84` - Change "gemini, zhipu-ai" → "gemini, zai"
   - `CLAUDE.md:126` - Remove zhipuai-sdk-nodejs-v4 from dependency list
   - `scripts/build.mjs:24` - Remove 'zhipuai-sdk-nodejs-v4' from external array

2. **Fix CLI routing issues**
   - `src/cli/index-cli.ts:42` - Remove dead `'observe-run'` case
   - `src/cli/index-cli.ts:5-31` - Fix help text or implement routing for show/stats commands

3. **Delete obviously unused types**
   - `src/core/types.ts` - Remove XML parsing types (SessionSummaryXML, SkipXML, ObservationXML)
   - `src/core/types.ts` - Remove v2 search types (CompactSearchResult, CompactMultiConceptResult)

**Testing:**
```bash
npm run build       # Verify build succeeds
npm test            # Run test suite (should pass)
npm run typecheck   # Verify no type errors
```

**Success Criteria:**
- All tests pass
- Build completes without errors
- No type errors
- Documentation accurately reflects current state

---

### Phase 2: Important Cleanup (1-2 hours)

**Goal:** Remove remaining dead code and improve clarity

**Changes:**

1. **Delete remaining unused types from types.ts**
   - Remove: `ToolCall`, `Observation`, `CompactObservation`, `SessionSummary`, `PendingEventType`, `PendingEvent`
   - Keep only: `ConversationExchange` (actively used by summarizer.ts)
   - Update test files that reference deleted types

2. **Add v2→v3 migration documentation**
   - Add section to CLAUDE.md explaining schema incompatibility
   - Document fresh install requirement for v3
   - Add schema version check to db.v3.ts to prevent v2 data corruption

3. **Verify utility usage in show.ts**
   - Check if `isMarkdown()` and `renderMarkdownSafely()` are used by MCP server
   - Remove if unused, or document if only used internally

4. **Standardize comment patterns**
   - Remove duplicate default value documentation in stop.ts
   - Update stale "removed tables" comment in db.v3.ts

**Testing:**
```bash
npm run build
npm test
npm run typecheck
# Manual: Test MCP search command end-to-end
```

**Success Criteria:**
- Test suite still passes (update tests for removed types)
- All exports in types.ts are actually used
- Migration path is clear for users

---

### Phase 3: Nice-to-Have Improvements (Later)

**Goal:** Address architectural debt and improve consistency

**Changes:**

1. **Consolidate wrapper scripts**
   - Extract common dependency-checking logic
   - Unify error handling between cli-graceful.mjs and mcp-server-wrapper.mjs
   - Document wrapper script patterns

2. **Standardize import patterns**
   - Use barrel imports from `src/core/llm/index.ts` consistently
   - Remove direct imports to llm/types.ts in favor of llm/index.ts

3. **Add schema migration utilities** (optional)
   - Create scripts/migrate-v2-to-v3.mjs for users with v2 data
   - Add schema version check on database open

**Testing:**
```bash
npm run build
npm test
npm run typecheck
# Test wrapper scripts with missing dependencies
```

**Success Criteria:**
- Wrapper scripts have consistent behavior
- Import patterns follow project conventions
- Migration path exists for v2 users (if implemented)

---

## Implementation Order

```
Phase 1 → Test & Validate → Phase 2 → Test & Validate → Phase 3
  (1h)                        (1-2h)                       (later)
```

**Decision Points:**
- After Phase 1: Validate changes work in production before Phase 2
- After Phase 2: Decide if Phase 3 is needed or defer

---

## Files to Modify

### Phase 1 (3 files)
- `plugins/conversation-memory/CLAUDE.md`
- `plugins/conversation-memory/scripts/build.mjs`
- `plugins/conversation-memory/src/cli/index-cli.ts`
- `plugins/conversation-memory/src/core/types.ts`

### Phase 2 (4 files)
- `plugins/conversation-memory/src/core/types.ts` (continued)
- `plugins/conversation-memory/CLAUDE.md` (add migration notes)
- `plugins/conversation-memory/src/core/db.v3.ts` (schema version check)
- `plugins/conversation-memory/src/core/show.ts` (verify usage)
- `plugins/conversation-memory/src/hooks/stop.ts` (comment cleanup)
- `plugins/conversation-memory/tests/**/*.test.ts` (update for removed types)

### Phase 3 (2-3 files)
- `plugins/conversation-memory/src/cli-graceful.mjs`
- `plugins/conversation-memory/scripts/mcp-server-wrapper.mjs`
- Various `src/core/llm/**/*.ts` files (import cleanup)

---

## Risk Assessment

### Phase 1: Very Low Risk
- Mostly deletions and documentation fixes
- Changes don't affect runtime behavior
- Easy to revert if issues found

### Phase 2: Low Risk
- Removes unused code that tests may reference
- Requires test updates but doesn't change functionality
- Migration notes are additive only

### Phase 3: Medium Risk
- Wrapper consolidation affects error handling
- Import changes could break if barrel exports incomplete
- More extensive testing required

---

## Success Metrics

**Phase 1 Completion:**
- ✅ Zero zhipu-ai references in docs/config
- ✅ CLI help text matches implementation
- ✅ 5 unused types removed
- ✅ All tests pass

**Phase 2 Completion:**
- ✅ Zero unused exports in types.ts
- ✅ Migration path documented
- ✅ All tests updated and passing
- ✅ Dead utility functions removed

**Phase 3 Completion:**
- ✅ Consistent wrapper patterns
- ✅ Standardized import style
- ✅ Optional: v2→v3 migration script exists

---

## Open Questions

1. **CLI routing strategy** - Should show/stats be routed through index-cli.ts or called directly?
   - **Decision needed in Phase 1**

2. **bun.lock handling** - Should we regenerate or ignore? (Not using Bun anyway)
   - **Low priority** - Document that plugin uses Node.js only

3. **Migration script necessity** - Do we need v2→v3 migration or just fresh install?
   - **Decision in Phase 2** - Based on user feedback

---

## Alternatives Considered

**Option A: Conservative Cleanup**
- Only Phase 1
- Rejected: Doesn't address unused types comprehensively

**Option B: Aggressive Modernization**
- All phases at once
- Rejected: Higher risk, harder to test incrementally

**Option D: Automated Analysis First**
- Run dead code tools before manual cleanup
- Rejected: Manual analysis already comprehensive

---

## Related Work

- Original v2→v3 migration: Commit e9f6cba6 (feat: remove zhipu-ai provider)
- Test coverage improvements: Commit 06cb8efd
- EmbeddingGemma upgrade: v2.0 release

---

## Next Steps

1. ✅ **Get approval for phased approach**
2. **Execute Phase 1** - Create implementation plan
3. **Test & validate** - Run full test suite
4. **Execute Phase 2** - Based on Phase 1 results
5. **Decide on Phase 3** - Evaluate necessity

---

## Appendix: Detailed Issue List

See comprehensive analysis report from Explore agent (agent ID: a90a0be) for complete issue breakdown including:
- 25 total issues across 8 files
- File-by-file recommendations
- Line-number specific references
- Severity and effort estimates
