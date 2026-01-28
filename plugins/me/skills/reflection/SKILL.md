---
name: reflection
description: Use when you just executed a skill/command and need to evaluate whether it worked as intended, identify problems, and suggest improvements
---

# Reflection

## Overview

Systematically evaluate whether a recently executed skill/command worked as intended. If problems exist, find root cause and suggest concrete improvements.

**Core principle:** Find root causes, not symptoms. Shift from "what went wrong" to "why it went wrong."

## When to Use

**Use for:**
- Right after skill/command execution
- Something feels off despite task completion
- Results differ from expectations
- Technically successful but inefficient

**Don't use for:**
- General tasks without skills
- Multi-skill session evaluation (out of scope)

## Evaluation Process

```
1. CAPTURE (30s): Identify last skill/command from conversation
2. EVALUATE (1min): Checklist-based assessment
3. DIAGNOSE (2min if issues): Recursive "why?" to root cause
4. RECOMMEND (1min): Specific, actionable improvements
```

## Step 1: Capture Context

### Identify Skill/Command

Scan recent 10-20 messages for:
- "Launching skill: [name]"
- "Using [skill-name] to"
- "/[command-name]"

If user specified name (`/reflection create-pr`), use that.

### Read Skill Definition

```bash
Read plugins/*/skills/[skill-name]/SKILL.md  # for skills
Read plugins/*/commands/[command-name].md    # for commands
```

### Collect Execution Context

- User's original request (intent)
- Skill's output
- Changed files/state
- Errors (if any)

## Step 2: Evaluate with Checklist

Use **checklist-based evaluation** instead of numeric metrics.

### Task Completion
- [ ] Achieved intended goal?
- [ ] Performed all required steps?
- [ ] Reached expected final state?

### Skill Rule Compliance
- [ ] Followed all MUST/ALWAYS rules?
- [ ] Violated no NEVER rules?
- [ ] Followed recommended workflow?

### Tool Usage
- [ ] Selected appropriate tools?
- [ ] Correct tool arguments?
- [ ] Correctly interpreted tool output?

### Error Handling (if errors occurred)
- [ ] Detected errors?
- [ ] Responded appropriately?
- [ ] Attempted to find root cause?

### Overall Verdict

- ✅ **Success**: All major items passed
- ⚠️ **Partial success**: Goal achieved but some rule violations or inefficiency
- ❌ **Failure**: Major goal unmet or serious rule violations

## Step 3: Diagnose Root Cause

If issues found, use **recursive "why?" questioning** to find root cause.

**Borrowed from CI-troubleshooting methodology:**

```
Observe symptom
  ↓
"Why?" → 1st cause
  ↓
"Why?" → 2nd cause
  ↓
"Why?" → Root cause
```

**Minimum 3 times, continue until "why?" is no longer meaningful.**

### Example

```
Symptom: create-pr skill didn't check merge conflicts
  ↓
Why? → Didn't run git merge-tree command
  ↓
Why? → Skipped that step
  ↓
Why? → Rationalized "already checked locally"
  ↓
Root cause: Skill's rationalization table doesn't cover this case
```

### Classify Problem

After finding root cause, classify as:

- **Skill bug**: SKILL.md rules incomplete or contradictory
- **Usage error**: Skill correct but misused
- **Environment/prerequisites**: Missing tools, files, state
- **Unexpected edge case**: Situation skill didn't consider

## Step 4: Recommend Improvements

### Immediate Actions

What needs to be done right now to fix the problem? Be specific.

```markdown
### Immediate Actions
1. [Specific command or action]
2. [Next step]
```

### Skill Modification (if applicable)

If skill bug, specify **which part of SKILL.md** and **how to modify**.

```markdown
### Skill Modification Needed
File: plugins/me/skills/create-pr/SKILL.md

Add to rationalization table:
- "Already checked locally" → Remote base may have changed
```

### Usage Improvement (if applicable)

If usage error, guide **what to watch for next time**.

```markdown
### Next Time
- Check [prerequisites] before skill execution
- Don't skip [specific step]
- Always verify [tool output]
```

## Output Format

```markdown
# Reflection: [skill-name]

## Execution Context
- **Goal**: [User's intent]
- **Skill**: [Skill/command name]
- **Expected**: [Expected result]
- **Actual**: [What actually happened]

## Evaluation

**Verdict**: ✅ Success | ⚠️ Partial | ❌ Failure

### Checklist
✅ Achieved goal
❌ MUST rule violated: "[specific rule]"
⚠️ Workflow not followed: "[which step]"
✅ Appropriate tool selection

## Diagnosis

### Root Cause Analysis
1. **Symptom**: [Observed problem]
2. **Why?** → [1st cause]
3. **Why?** → [2nd cause]
4. **Root cause**: [Actual problem to solve]

### Classification
- [ ] Skill bug
- [ ] Usage error
- [ ] Environment/prerequisites
- [ ] Edge case

## Recommendations

### Immediate Actions
1. [Specific action 1]
2. [Specific action 2]

### Skill Modification (if applicable)
[Which part of SKILL.md to modify]

### Next Time (if applicable)
[What to watch for]
```

## Common Rationalization (REJECT ALL)

Pressure situations tempt you to skip or rush reflection. Reject all.

| Excuse | Reality |
|--------|---------|
| "Technically successful" | Rule violation = failure |
| "Small violation, ignore" | Small violation is still violation |
| "Already spent enough time" | 5min saves hours later. Sunk cost fallacy |
| "Need to move fast" | Doing it right > doing it fast |
| "Asked why 2-3 times" | Min 3, continue to root cause |
| "Practical fix exists" | Symptom fix ≠ root cause fix |
| "Answer is obvious" | Prove with evidence, not guesses |
| "User is satisfied" | Preventing recurrence matters more |
| "Outcome over process" | Both matter when process is required |
| "Almost right" | "Almost" = failure. Good enough isn't |
| "Spirit over letter" | Violating letter = violating spirit |
| "Tests pass" | Test pass ≠ correct process |

## Red Flags - STOP

These thoughts mean you're rationalizing:

### Skipping Reflection
- "Technically successful, so fine"
- "Already spent enough time"
- "Need to move fast"
- "Tests pass, no reflection needed"

### Early Termination of Root Cause Analysis
- "Asked why 2-3 times, that's enough"
- "Practical solution exists, done"
- "Answer is obvious"
- "Don't know why but it's fixed"
- "Root cause takes too long"

### "Partial Success" Framing
- "Almost right"
- "Good enough"
- "Spirit matters, not letter"
- "Outcome matters, not process"
- "Small violation, ignore"

**All are rationalizations. Find root cause.**
