# Skill Development with TDD

## Iron Law

**NO SKILL WITHOUT A FAILING TEST FIRST.**

If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

## TDD Cycle for Skills

### RED Phase: Document Failures

1. Create pressure scenarios WITHOUT the skill
2. Run agents through realistic tasks
3. Document EVERY violation of desired behavior
4. Capture specific failure modes

**Example RED:**
```
Task: "Create a new plugin component"

Observed failures without skill:
- Created 50-line command (should be skill)
- No test before writing
- Missing required plugin.json fields
- Wrong naming convention (camelCase)
- No README
```

### GREEN Phase: Minimal Solution

1. Write skill addressing ONLY those documented issues
2. Keep it minimal - don't add "nice to haves"
3. Focus on the specific violations from RED phase

**Example GREEN:**
```markdown
## When to Create Skills vs Commands

| Signal | Command | Skill |
|--------|---------|-------|
| Line count | 5-20 | 50+ |
| Steps | 1-3 | 4+ |

## Plugin Requirements

- plugin.json MUST have: name, version, description
- Name MUST be lowercase-with-hyphens
- README.md is required
```

### REFACTOR Phase: Close Loopholes

1. Test skill with new agents/scenarios
2. Watch for rationalization ("this doesn't apply because...")
3. Add anti-rationalization measures
4. Close decision loopholes

**Example REFACTOR:**
```
Agent rationalization: "This is 9 steps but simple, so command."

Add to skill: "9 steps in 11 lines is still 9 steps. Steps count, not lines."
```

## SKILL.md Structure

### Frontmatter (Required)

```yaml
---
name: skill-name              # letters, numbers, hyphens only
description: Use when [trigger]  # Third person, trigger ONLY
---
```

### Description Rules

**MUST start with "Use when..."**

**GOOD:**
```yaml
description: Use when creating Claude Code slash commands
```

**BAD:**
```yaml
description: A guide for creating commands that enforces simplicity
```
(Describes content, not trigger)

**BAD:**
```yaml
description: Create commands following best practices
```
(Imperative, not third person)

**BAD:**
```yaml
description: Use when creating commands. This guide covers command patterns,
anti-patterns, frontmatter reference, and deployment...
```
(Summarizes workflow, belongs in body)

## Token Efficiency Guidelines

### Word Limits by Frequency

| Skill Type | Word Limit | Rationale |
|------------|------------|-----------|
| Getting-started | <150 | Loaded frequently, needs to be punchy |
| Frequently-used | <200 | Context budget conservation |
| Others | <500 | Reference material, can be longer |

### When to Split Reference Files

**Separate file when:**
- Reference content >100 lines
- Examples >50 lines
- Multi-language code samples
- Reusable across multiple skills

**Don't separate when:**
- Content is skill-specific (not reference)
- Examples demonstrate core concept (not reference)
- Content <100 lines

### @ Syntax Usage

**Use sparingly:** `@other-skill` force-loads that skill's content.

**GOOD:** Rare, for truly necessary cross-references

**BAD:** Every section has @ references (burns context)

## Skill Content Structure

### Required Sections

1. **Overview** - Core principle in one sentence
2. **When to use** - Clear triggering conditions
3. **Quick reference** - Decision tables, checklists
4. **Implementation** - Examples, patterns
5. **Anti-patterns** - Common mistakes with fixes
6. **Rationalization table** - For discipline skills

### Optional Sections

- Flowcharts (for decision-heavy skills)
- Code examples (one excellent example, not multi-language)
- Troubleshooting
- FAQ

### Section Guidelines

**Overview:** 1-3 sentences. Core principle only.

**Quick reference:** Tables over lists. Scan-friendly.

**Implementation:**
- One excellent example preferred
- Multiple examples only if genuinely different approaches
- Avoid multi-language examples (bloat)

**Anti-patterns:**
- Real examples from testing
- Show BAD, then GOOD
- Explain WHY bad fails

**Rationalization table:**
- Left: Excuse agents make
- Right: Reality check
- Be specific, not generic

## Decision Trees and Flowcharts

Use when:
- Decision has multiple branches
- Non-obvious when/when-not logic
- Skill is discipline-focused (prevents rationalization)

**Example:**
```
Should this be a command or skill?

Is task simple/straightforward?
│
├─ Yes ──> 1-3 steps?
│           │
│           ├─ Yes ──> Command (5-20 lines)
│           └─ No ──> Skill
│
└─ No ──> Skill
```

## Common Skill Mistakes

### Description Summarizes Workflow

**BAD:**
```yaml
description: Use when creating skills. Follows TDD cycle with RED-GREEN-REFACTOR
phases, enforces minimal skill writing, and closes rationalization loopholes.
```

**GOOD:**
```yaml
description: Use when creating or reviewing Claude Code skills
```

### Over-Explaining in Description

**BAD:**
```yaml
description: Use when creating skills, which are reusable workflows that agents
follow automatically based on context. Skills differ from commands...
```

**GOOD:**
```yaml
description: Use when creating multi-step workflows or reusable patterns
```

### No Failing Test

**Mistake:** Writing skill from "best practices" without testing

**Reality:** You don't know what the skill needs to teach

**Fix:** Run agents without skill first, document failures

### Word Count Bloat

**Mistake:** 800-word "getting-started" skill

**Reality:** Gets truncated or ignored

**Fix:** ruthless editing, separate reference files

## Quick Checklist

### Before Writing
- [ ] Documented failures without skill?
- [ ] Specific violations identified?

### While Writing
- [ ] Description: "Use when..." + trigger only?
- [ ] Overview: 1-3 sentences?
- [ ] Under word limit for frequency?

### After Writing
- [ ] Test with new agent/scenario?
- [ ] Agent rationalizes around rules?
- [ ] Add to rationalization table?

## Sources

- [superpowers writing-skills](https://github.com/obra/superpowers/tree/main/skills/writing-skills)
- [Test-Driven Development](https://github.com/obra/superpowers/tree/main/skills/test-driven-development)
