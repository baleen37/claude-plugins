---
name: create-pr
description: Use when user requests commit, push, PR creation, merge, or git workflow. Enforces base branch verification and conflict detection before pushing.
version: 1.0.0
user-invocable: true
---

# Create PR

Automates git workflow: commit → conflict check → push → PR creation.

**Core principle**: Always verify base branch and conflicts before pushing.

## When to Use

Use when user says:
- "Create PR" / "Make PR" / "Open PR"
- "Commit and push"
- "Push this"
- "Ready to merge"

Do NOT use when:
- User only wants to commit (not push)
- Changes not ready (tests failing, WIP)

## Red Flags - STOP

Stop if:
- You don't know which base branch to use
- You skipped conflict check before push
- You used `git add` without first running `git status`
- You created PR but didn't check status afterward
- You stopped at PR creation without verifying merge-ready
- You said "GitHub will notify" or "CI will catch it"
- You said "just pushed so base hasn't changed"

**All of these mean: Follow complete workflow.**

## Quick Reference

```bash
# 1. Check status
git status
git log --oneline -5

# 2. Add specific files
git add path/to/file1 path/to/file2

# 3. Commit
git commit -m "type: description"

# 4. Verify base branch
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
# OR ask user if unclear

# 5. Check conflicts BEFORE push
git fetch origin <base-branch>
git merge-tree $(git merge-base HEAD origin/<base-branch>) HEAD origin/<base-branch>

# 6. Push
git push -u origin HEAD

# 7. Create PR with explicit base
gh pr create --base <base-branch> --title "..." --body "..."

# 8. Check PR status
gh pr view --json mergeable,mergeStateStatus

# 9. Update if behind
git fetch origin <base-branch>
git merge origin/<base-branch> --no-edit
git push
```

## Workflow

### 1. Commit Changes

```bash
# Always check what will be added
git status

# Add SPECIFIC files (not -A)
git add src/file1.ts src/file2.ts

# Commit
git commit -m "feat: add new feature"
```

**Never**: `git add -A` without reviewing `git status` first

### 2. Determine Base Branch

**Option A - Check repository default:**
```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
```

**Option B - Check existing PR:**
```bash
gh pr list --limit 1 --json baseRefName -q '.[0].baseRefName'
```

**Option C - Ask user:**
If both fail or unclear, ask: "Which branch should this PR target? (main/develop/other)"

**Never**: Assume without verification

### 3. Check Conflicts Before Push

```bash
git fetch origin <base-branch>
git merge-tree $(git merge-base HEAD origin/<base-branch>) HEAD origin/<base-branch>
```

**Exit code 0**: No conflicts, proceed
**Exit code 1**: Conflicts detected, show user and ask how to proceed

### 4. Push

```bash
git push -u origin HEAD
```

### 5. Create PR

```bash
gh pr create \
  --base <base-branch> \
  --title "Title from commit" \
  --body "$(cat <<'EOF'
## Summary
- Change 1
- Change 2

## Test plan
- [ ] Tests pass
- [ ] Manual verification completed
EOF
)"
```

**Always use `--base` flag explicitly**

### 6. Verify PR Status (Post-Creation)

```bash
# Get current PR
gh pr view --json mergeable,mergeStateStatus,mergeabilityStatus

# Check status
# CLEAN = ready to merge
# BEHIND = update branch needed
# DIRTY/CONFLICTING = conflicts exist
```

### 7. Update Branch When Behind

```bash
git fetch origin <base-branch>
git merge origin/<base-branch> --no-edit
git push
```

**Always update** when status is BEHIND, even if mergeable shows true

### 8. Resolve Conflicts

**Auto-resolve when possible:**
- Whitespace/formatting conflicts
- Non-overlapping import changes
- Independent additions

```bash
git merge origin/<base-branch>
# If conflicts, check files
git status | grep "both modified"

# Try resolution, commit if successful
git add <resolved-files>
git commit --no-edit
git push
```

**Ask user when:**
- Logic conflicts (overlapping changes)
- More than 3 conflicted files
- Unclear which version to keep

## PR Body Template

```markdown
## Summary
- Bullet list of changes (from commits)

## Test plan
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing done
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Omit `--base` flag | Always specify explicitly |
| `git add -A` blindly | Run `git status` first |
| Skip conflict check before push | Always check before push |
| Assume base branch | Verify via `gh repo view` |
| Stop after PR creation | Check status and update branch |
| Assume merge-ready | Verify mergeStateStatus |

## Rationalization Table

| Excuse | Reality |
|--------|---------|
| "PR created, done" | Created ≠ merge-ready. Check status. |
| "GitHub will notify" | Be proactive. Check now. |
| "Just pushed, base unchanged" | Base can update anytime. Always check. |
| "CI will catch it" | CI runs after merge-ready. Verify first. |
| "Too complex to auto-resolve" | Try auto-resolution first. Ask if fails. |

## Arguments

Parse `$ARGUMENTS`:
- `--base <branch>`: Override base branch detection
- `--draft`: Create draft PR
- `--automerge`: Enable auto-merge after creation

Example: `/create-pr --base develop --draft`
