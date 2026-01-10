# Command Development Guide

**Commands are THIN entry points, not comprehensive systems.**

A command is a 5-15 line prompt that either:
1. Gives simple, direct instructions, OR
2. Delegates to a skill for complex work

## The Simplicity Test

**If your command is longer than 20 lines, you're building a skill, not a command.**

## When to Use Commands vs Skills

| Signal | Command | Skill |
|--------|---------|-------|
| Line count | 5-20 | 50+ |
| **Steps** | **1-3** | **4+** |
| Decision points | 0-1 | Multiple |
| Checklists | Never | Often |
| Personas | Never | Sometimes |
| Output templates | Simple/none | Structured |

**The Step Rule (Most Important):**

Count the numbered steps. **4+ steps = skill, period.**

You cannot "simplify" 9 steps into a command by writing them on fewer lines.

## Command Patterns

### Pattern 1: Direct Instruction (Most Common)

```markdown
---
description: Review code for security vulnerabilities
---

Examine this code for SQL injection, XSS, auth bypasses, and input validation.
Report findings with file:line and severity.
```

**3 lines. Done.**

### Pattern 2: Skill Wrapper (For Complex Tasks)

```markdown
---
description: Comprehensive security analysis with OWASP coverage
---

Use and follow the security-review skill exactly as written.
```

**1 line. The skill has the complexity, not the command.**

### Pattern 3: Tool Permission Setup

```markdown
---
allowed-tools: Bash(git:*)
description: Quick git status check
---

Run git status and summarize changes.
```

**2 lines.**

## Frontmatter Reference

```yaml
---
description: What this command does (max 100 chars, third person)  # REQUIRED
allowed-tools: Bash(git:*), Read, Edit                              # If using tools
argument-hint: [branch-name]                                        # If taking args
---
```

### description

- **Third person only:** "Review code" not "Review the code"
- **Max 100 chars:** Keep it concise
- **Describe WHAT:** What command does, not how

**GOOD:**
```yaml
description: Review code for security vulnerabilities
```

**BAD:**
```yaml
description: This command will review your code to find security issues
```

### allowed-tools

**Specify when:** Command uses Bash, Read, Write, Edit tools

**Format:**
```yaml
allowed-tools: Bash              # All Bash access
allowed-tools: Bash(git:*)       # Git commands only
allowed-tools: Bash(git:status, git:diff)  # Specific git commands
allowed-tools: Read, Edit        # Multiple tools
allowed-tools: *                 # All tools (rare)
```

### argument-hint

**Use when:** Command takes user arguments

**Format:**
```yaml
argument-hint: [branch-name]
```

Shows as: `/my-command [branch-name]`

## Creating a Command

1. **Identify the need:** What repetitive task needs a shortcut?
2. **Check complexity:** Does it need 4+ steps? → Create skill first
3. **Write minimal prompt:** 5-15 lines max
4. **Add tool permissions:** If using Bash/Read/Write
5. **Test:** Run command, verify it works

## Anti-Patterns (Real Examples)

### Over-Engineered Security Command (101 lines)

```markdown
# BAD - This is a SKILL disguised as a command
---
description: Comprehensive security analysis for OWASP Top 10...
---

You are a senior security engineer...  # ❌ Persona

## Scope of Analysis
1. **OWASP Top 10 Vulnerabilities:**
   - A01:2021 - Broken Access Control
   - A02:2021 - Cryptographic Failures
   [... 8 more items ...]              # ❌ Comprehensive checklist

## Review Process
1. **Scan Phase:** ...
2. **Analysis Phase:** ...
3. **Validation Phase:** ...
4. **Documentation Phase:** ...        # ❌ Multi-phase workflow

## Output Format
### Executive Summary
### Critical Findings (Severity: CRITICAL)
- **Title:** ...
- **Location:** ...
[... 20 more lines ...]               # ❌ Detailed output template
```

### Correct Version (3 lines)

```markdown
---
description: Review code for security vulnerabilities
---

Examine this code for SQL injection, XSS, auth bypasses, and input validation.
Report findings with file:line and severity.
```

**Or if you need comprehensive coverage:**

```markdown
---
description: Comprehensive OWASP security analysis
---

Use and follow the security-review skill exactly as written.
```

## Red Flags - STOP and Simplify

If you find yourself doing ANY of these, STOP:

- Adding a persona ("You are a senior...")
- Creating a checklist with 5+ items
- Defining multiple phases or steps
- Writing an output template
- Command exceeds 20 lines

**Fix:** Create a skill with the complexity, then write a 1-line wrapper command.

## Rationalization Table

| Excuse | Reality |
|--------|---------|
| "Comprehensive coverage ensures nothing is missed" | Checklists belong in skills, not commands |
| "Following systematic approach" | Systematic = skill. Command = simple trigger |
| "Matches existing complex commands" | Those commands should be skills too |
| "User asked for comprehensive" | Create skill, wrap with 1-line command |
| "Being thorough is good" | Being simple is better for commands |
| "I simplified it to under 20 lines" | 9 steps in 11 lines is still 9 steps. Steps count, not lines |
| "It's urgent/deadline" | Urgency doesn't change what belongs in a skill |
| "I'm just listing what to do" | A list of 5+ steps IS a workflow. Workflow = skill |

## Deployment Locations

| Location | Scope | Shows as |
|----------|-------|----------|
| `.claude/commands/` | Project | (project) |
| `~/.claude/commands/` | Personal | (user) |

## Quick Checklist

- [ ] Under 20 lines?
- [ ] Description under 100 chars?
- [ ] `allowed-tools` if using Bash/Read/Write?
- [ ] No personas, checklists, or output templates?
- [ ] Works when invoked?

## Sources

- [superpowers writing-claude-commands](https://github.com/obra/superpowers/blob/main/skills/writing-claude-commands/SKILL.md)
