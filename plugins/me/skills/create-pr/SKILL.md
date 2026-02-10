---
name: create-pr
description: Use when the user asks to "create a PR", "create pull request", "open a PR", "submit a PR", "make a pull request", "merge PR", or requests complete git workflow including commit, push, and PR creation
---

# Create PR

## Overview

Complete git workflow with verification at every transition. Prevents broken PRs, wrong target branches, and merge conflicts.

## When to Use

User asks for PR creation OR requests commit → push → PR workflow.

## Quick Reference

| Step | Command | Purpose |
|------|---------|---------|
| Pre-flight | `git status && git branch --show-current` | Check branch, block main/master, verify changes |
| Commit | `git add <files> && git commit -m "type(scope): description"` | Stage specific files only |
| Conflict check | `${CLAUDE_PLUGIN_ROOT}/skills/create-pr/scripts/check-conflicts.sh "$BASE"` | Verify clean merge BEFORE pushing |
| Push | `git push -u origin HEAD` | Push to remote |
| Create PR | `gh pr create --base "$BASE" --title "..." --body "..."` | Create with correct target branch |
| Verify | `${CLAUDE_PLUGIN_ROOT}/skills/create-pr/scripts/verify-pr-status.sh "$BASE"` | Confirm merge-ready (CLEAN + CI passed) |

## Red Flags - STOP

**Critical mistakes that break the workflow:**

- Hardcoding `--base main` → breaks when default branch changes (omit `--base` instead)
- Skip conflict check → pushes broken PR, breaks remote
- Stop at PR creation → not verified merge-ready
- `git add` without `git status` → adds unintended files
- Proceed from main/master → violates branch protection
- **No changes to commit** → inform user, don't proceed

**Violating the letter of the rules is violating the spirit of the rules.**

## Common Mistakes

| Mistake | Why It's Wrong | Fix |
|---------|----------------|-----|
| Using `git add -A` | Stages untracked files (secrets, temps) | Always `git status` first, add specific files |
| Hardcoding `--base main` | Wrong target branch | Omit `--base` - `gh pr create` uses default branch automatically |
| Skipping verify script | PR may be DIRTY, BEHIND, or CI-failing | Always run verify-pr-status.sh after creation |
| Pushing to main/master | Violates protection rules | Block if `git branch --show-current` shows main/master |

## Implementation

### Pre-flight

```bash
# Check current state
git status
git log --oneline -5
git branch --show-current

# Block if on main/master
# Block if no changes (working tree clean)
```

### Commit

```bash
# Stage specific files only (never -A)
git add <specific-files>
git commit -m "type(scope): description"
```

### Conflict Check (REQUIRED)

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/create-pr/scripts/check-conflicts.sh"
```

Exits with:
- `0` - No conflicts, safe to proceed
- `1` - Conflicts detected, manual resolution required
- `2` - Error (missing branch, git errors)

### Push

```bash
git push -u origin HEAD
```

### Create PR

```bash
gh pr create --title "$(git log -1 --pretty=%s)" --body "<comprehensive description>"
```

`gh pr create` automatically uses the repository's default branch as base.

**PR body must include:**
- Summary of changes
- Technical details
- Testing approach
- Breaking changes (if any)

Check `.github/PULL_REQUEST_TEMPLATE.md` for project-specific format.

### Verify Merge-Ready (CRITICAL)

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/create-pr/scripts/verify-pr-status.sh"
```

Handles:
- **CLEAN** + CI passed → merge-ready, exit 0
- **BEHIND** → auto-update branch, max 3 retries
- **DIRTY** → conflicts detected, resolution steps provided
- **BLOCKED/UNSTABLE** → CI still running or failed, exit 2
- **CI failures** → shows failed required checks, exit 1

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Conflict check takes too long" | 5 seconds now vs hours of conflict resolution later |
| "I know the default branch is main" | Hardcoding breaks when default changes |
| "PR creation is enough" | Unverified PRs break CI, waste reviewer time |
| "I'll check status manually" | You won't. Script catches BEHIND/DIRTY automatically |
| "Small changes don't need verification" | Small changes break production too |
