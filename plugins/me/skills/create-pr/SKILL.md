---
name: create-pr
description: Handle complete git workflow (commit → push → PR) with parallel context gathering, --base enforcement, and merge conflict detection. Use when user asks to commit, push, create PR, mentions git workflow, or says "auto merge".
user-invocable: true
---

# Create PR Skill

Automates: context gathering → conflict check → commit → push → PR creation/update.

**Announce at start:** "I'm using the create-pr skill to handle the git workflow."

## Arguments

Parse `$ARGUMENTS` for flags:
- `--draft` - Create draft PR
- `--automerge` - Auto-enable merge after PR creation

## Core Principles

1. **Parallel context gathering** - Run all checks simultaneously
2. **Mandatory --base flag** - Never omit when creating PRs
3. **Conflict check first** - Before any push
4. **Specific file staging** - Avoid `git add -A` without verification

## Workflow (5 Steps)

### 1. Gather Context

```bash
bash {baseDir}/scripts/pr-check.sh
```

**Outputs:**
- `BASE` - Default branch
- Current branch, git status
- PR state: `OPEN`, `NO_PR`, `MERGED`, or `CLOSED`
- Changed lines count
- PR template (if exists)

### 2. Check Conflicts

```bash
bash {baseDir}/scripts/conflict-check.sh $BASE
```

Pass `$BASE` from step 1. **Exit 0** = No conflicts → proceed. **Exit 1** = Conflicts → resolve first (see [references/conflict_resolution.md](references/conflict_resolution.md))

### 3. Create WIP Branch (if on main/master)

**Never commit to main/master directly.**

```bash
git checkout -b wip/<description>
```

Use 2-4 words: `wip/fix-auth`, `wip/add-api`

### 4. Commit

```bash
git status                          # Review first
git add path/to/file1 file2         # Specific files
git commit -m "feat: description"   # Conventional Commits
```

**Only use `git add -A` if:**
- Just ran `git status` AND
- Verified all changes are intentional

### 5. Push & Create/Update PR

```bash
git push -u origin HEAD
```

**Action by PR state:**

| State | Action | Command |
|-------|--------|---------|
| `OPEN` | Update | `gh pr edit --title "$TITLE" --body "$BODY"` |
| `NO_PR` | Create | `gh pr create --base $BASE [--draft] --title "$TITLE" --body "$BODY"` |
| `MERGED` | Create | Same as NO_PR |
| `CLOSED` | Ask user | "Create new or reopen?" |

**PR Title:**
- Single commit: Use commit message
- Multiple commits: Combine top 2-3 into summary

**PR Body Template:**
```markdown
## Summary
- Change 1 (from commits)
- Change 2 (from commits)

## Test plan
- [x] Tests pass
- [x] Manual verification
```

**After PR creation (NO_PR/MERGED):**
If `--automerge` flag passed:
```bash
gh pr merge --auto --squash
```

## Auto-Merge (Optional)

**Default:** Don't auto-merge. Let CI run first.

Ask user after PR creation: "Wait for CI and merge automatically? (yes/no)"

If **yes**:
```bash
gh run watch                              # Wait for CI
gh run view --json conclusion,state       # Confirm passed
# If passed, ask: "CI passed. Merge with squash? (y/n)"
gh pr merge --squash --delete-branch      # Only if confirmed
```

**Only auto-merge when ALL true:**
- User explicitly requests
- CI passes
- User confirms after seeing CI results
- Changes are trivial (<50 lines) OR user reviewed this session

**Never auto-merge if:**
- Tests flaky/skipped
- Critical paths (auth, payments, security)
- PR >50 lines without review
- CI failed

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Omit `--base` | Always use `--base $BASE` |
| `git add -A` blindly | Check status first |
| Sequential gathering | Use pr-check.sh (parallel) |
| Skip conflict check | Always run conflict-check.sh |

## Error Handling

| Error | Check | Fix |
|-------|-------|-----|
| `gh` fails | `gh auth status` | `gh auth login` |
| Push fails | `git remote -v` | `git remote add origin <url>` |

## References

- [Conflict Resolution Guide](references/conflict_resolution.md)
- [Evaluation Scenarios](references/evaluation.md)
- [Quick Start Checklist](QUICK_START.md)
