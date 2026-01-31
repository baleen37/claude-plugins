---
name: research
description: Use when exploring unfamiliar codebases, investigating bugs, or learning new technologies before acting
---

# Research

## Overview

Evidence-based exploration: **Observe → Explore → Verify → Summarize**.

**Core principle:** 30 minutes of targeted research beats hours of wrong implementation.

## When to Use

```
Need to understand before acting?
    │
    ├─ Unfamiliar codebase/architecture? → YES
    ├─ Investigating bug or unexpected behavior? → YES
    ├─ Learning new technology/framework? → YES
    └─ Simple, well-understood task? → NO (just do it)
```

**Use for:**
- Understanding requirements before implementation
- Investigating root causes
- Learning new domains
- Comparing approaches

**Don't use for:**
- Routine fixes in familiar code
- Well-documented APIs you know
- Simple mechanical changes

## Quick Reference

| Phase | Codebase-only | Web-only | Hybrid |
|-------|---------------|----------|--------|
| **Observe** | Clarify scope, identify files | Clarify question, note version | Define independent scopes |
| **Explore** | Task: Explore agent | Task: web-researcher agent | Task: Explore + web-researcher (parallel) |
| **Verify** | Run code, cross-reference files | Cross-check multiple sources | Compare code vs docs findings |
| **Summarize** | File paths, line numbers | URLs, version info | Combined evidence from both |

## Subagent Strategy

### Why Subagents?

Research benefits from subagent delegation:
- **Fresh context** per research question (no contamination)
- **Parallel execution** of independent research tracks
- **Cost efficiency** using Haiku for focused tasks
- **Focused scope** reduces confusion and improves accuracy

### Model Selection

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Codebase exploration | **haiku** (Explore agent default) | Fast, cheap, sufficient for code search |
| Web research | **haiku** (web-researcher agent) | Quick information gathering |
| Complex synthesis | **sonnet** (main session) | Analysis requires deeper reasoning |
| Verification requiring execution | **sonnet** | May need to run code/analyze |

**Rule of thumb:** Use Haiku for subagent research tasks. Reserve Sonnet for final synthesis and complex verification.

## Research Scenarios & Tool Selection

| Scenario | Tool Command | Model | When to Use |
|----------|-------------|-------|-------------|
| **Codebase-only** | `Task tool: subagent_type="Explore"` | haiku | Unfamiliar architecture, existing bugs, code patterns |
| **Web-only** | `Task tool: subagent_type="me:web-researcher"` | haiku | New tech, official docs, version-specific info |
| **Hybrid** | Parallel: Explore + web-researcher | haiku (both) | Code vs docs comparison, version mismatches |

## Tool Usage Guidelines

### For Codebase Research

**DO:**
```markdown
Task tool with subagent_type="Explore", description="Search codebase for X implementation patterns"
```

**DON'T:**
- Use Grep/Glob directly for exploration (slow, single-source)
- Use Explore agent for web search (it has no web tools)
- Use general-purpose agent when Explore is specialized for codebase

### For Web Research

**DO:**
```markdown
Task tool with subagent_type="me:web-researcher", description="Find official documentation for X framework"
```

**DON'T:**
- Use built-in WebSearch tool (use web-researcher agent instead)
- Skip version context (always specify version when relevant)
- Rely on single source (web-researcher will cross-reference)

### For Hybrid Research (Parallel Pattern)

When you have independent codebase AND web research questions:

```markdown
# Define independent scopes
Subtask A: "How is authentication implemented in our codebase?"
Subtask B: "What are the official authentication patterns for Framework X?"

# Dispatch in parallel (use Task tool in single message with multiple Task calls)
Task 1: subagent_type="Explore", description="Search codebase for authentication implementation"
Task 2: subagent_type="me:web-researcher", description="Find Framework X official authentication patterns"

# Synthesize findings
Compare: Our implementation vs official docs
Identify: Gaps, anti-patterns, version mismatches
```

## Evidence Standards

**Cross-reference threshold:** Verify with 3+ independent sources before concluding.

**Insufficient evidence:**
- "Read the code, it does X" → Which files? Which lines?
- "This approach works" → Tested? Verified?
- "Confident based on experience" → Experience ≠ verification
- Single source without verification → Cross-reference required

**Sufficient evidence:**
- "lib/state.sh:45-52 validates session_id with regex `^[a-zA-Z0-9_-]+$`"
- "Tested with empty session_id → exits with error code 1"
- "Verified against official docs v5.3.0"
- Cross-referenced across 3+ sources with consistent findings

**Negative evidence:** Explicitly document what's NOT there:
- "No 'prompt' or 'agent' hook type examples found in codebase"
- "No locking mechanism exists despite concurrent execution"
- "No test coverage for parallel execution scenarios"

## Rationalization (REJECT ALL)

| Excuse | Reality |
|--------|---------|
| "Code review is enough" | Code ≠ behavior. Test it. |
| "User wants fast answer" | Fast right > fast wrong. Rework takes longer. |
| "This is straightforward" | Simple still requires verification. Don't guess. |
| "Confident based on experience" | Confidence ≠ correctness. Verify with evidence. |
| "Too much to read" | 30 min targeted research vs hours of rework. |
| "Logic is sound" | Logical ≠ correct. Reality beats theory. |
| "Tests pass, must be user error" | Tests may not cover your scenario. Verify actual conditions. |
| "Simple read-write can't be broken" | Simple operations have race conditions without synchronization. |
| "Race conditions are rare" | Rare bugs become common at scale. Verify, don't assume. |
| "Just add a lock" | Locks add complexity. Verify the problem exists first. |
| "I've seen enough examples" | Patterns may have edge cases you haven't seen. Keep verifying. |
| "The schema tells me everything" | Schema defines structure, not behavior. Test it. |

## Red Flags - STOP

These thoughts mean you're rushing or rationalizing:

### Subagent Anti-patterns
- "I'll search myself" → Use subagents for research. You synthesize.
- "Sequential is fine" → Independent research = parallel execution.
- "Sonnet for everything" → Haiku sufficient for focused research tasks.
- "Explore agent can search web" → Explore has NO web tools.
- "mgrep is just for search" → mgrep --web --answer provides synthesis.
- "General-purpose is safer" → Specialized agents (Explore, web-researcher) are more focused.

### Skipping Verification
- "Read enough, let's summarize" → Evidence ≠ volume. Quality sources matter.
- "Logic makes sense" → Theory ≠ reality. Test it.
- "No time to verify" → Verification prevents rework.

### Insufficient Evidence
- "I understand the pattern" → Verify in current codebase context.
- "This is standard practice" → Standard for what? When? Prove it.
- "Good enough to proceed" → Evidence-based or assumption-based?

### Premature Conclusions
- "Findings align with expectation" → Confirmation bias risk. Look for contradictions.
- "No issues found" → Did you look for edge cases? Error paths? Negative evidence?
- "Ready to implement" → Are findings documented with sources?
- "Seen enough examples" → Keep verifying. Patterns may have unseen edge cases.

**Research means evidence-first. Always.**

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Not using subagents for research | Delegate to Explore/web-researcher - faster, cheaper, fresh context |
| Sequential hybrid research | Run codebase + web research in parallel when independent |
| Using Sonnet for simple research | Haiku is sufficient and cost-efficient for subagent tasks |
| Single-source reliance | Cross-reference findings from multiple sources (3+ minimum) |
| No documentation | Document as you go with file paths/line numbers or URLs |
| Skipping edge cases | Explicitly check error paths and boundaries |
| Logical inference only | Run code, verify actual behavior |
| Premature recommendations | Findings first, recommendations second |
| Ignoring negative evidence | Explicitly document what's NOT there or NOT working |
| Assuming tests cover everything | Tests may miss race conditions, parallel execution |
| Schema without verification | Schema defines structure, not behavior. Test it. |
| Codebase-only research | Check official docs for version-specific behavior |

## Output Format

```markdown
# Research Findings: [topic]

## Context
[Original question and research scope]

## Key Findings
[Primary discoveries with specific file paths and line numbers]

## Evidence Summary
- Source 1: [file:line or URL] - [specific quote or observation]
- Source 2: [file:line or URL] - [specific quote or observation]
- Source 3: [file:line or URL] - [specific quote or observation]

## Verification
[Test performed, actual results, edge cases checked]

## Open Questions
[Unresolved items requiring further research]

## Confidence Level
High / Medium / Low with rationale

## Recommendations
[Actionable next steps based on findings]
```
