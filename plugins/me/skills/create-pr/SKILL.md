---
name: create-pr
description: Handle complete git workflow (commit → push → PR) with parallel context gathering, --base enforcement, and merge conflict detection. Use when user asks to commit, push, create PR, mentions git workflow, or says "auto merge".
user-invocable: true
---

# Create PR Skill

Automates: context gathering → update branch (if needed) → conflict check → commit → push → PR creation/update.

**Announce at start:** "I'm using the create-pr skill to handle the git workflow."

## Arguments

Parse `$ARGUMENTS` for flags:
- `--draft` - Create draft PR
- `--automerge` - Auto-enable merge after PR creation
- `--base <branch>` - Explicitly specify base branch (overrides auto-detection)

## Workflow

### 1. Gather Context

```bash
bash {baseDir}/scripts/pr-check.sh
```

**Outputs:** BASE, branch status (behind/ahead), conflict preview, PR state, changed lines, PR template

### 2. Update Branch (if needed)

**If pr-check.sh shows "behind origin/$BASE":**

```bash
git merge origin/$BASE
# Resolve conflicts if any, then:
git push
```

### 3. Check Conflicts

```bash
bash {baseDir}/scripts/conflict-check.sh $BASE
```

Exit 0 = proceed, Exit 1 = resolve conflicts first

### 4. Create WIP Branch (if on main/master)

```bash
git checkout -b wip/<description>
```

### 5. Commit

```bash
git status
git add <specific-files>
git commit -m "feat: description"
```

### 6. Push & Create/Update PR

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

**PR Title:** Single commit = use message, Multiple commits = combine top 2-3

**PR Body Template:**
```markdown
## Summary
- Change 1
- Change 2

## Test plan
- [x] Tests pass
- [x] Manual verification
```

**After PR creation (if --automerge):**
```bash
gh pr merge --auto --squash
```

## Auto-Merge (Optional)

Default: Don't auto-merge. Ask user: "Wait for CI and merge automatically? (yes/no)"

If yes:
```bash
gh run watch
gh run view --json conclusion,state
# If passed, ask: "CI passed. Merge with squash? (y/n)"
gh pr merge --squash --delete-branch
```

**Only auto-merge when:** User requests + CI passes + User confirms + (<50 lines or reviewed)

**Never auto-merge if:** Tests flaky, critical paths, >50 lines without review, CI failed

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Omit `--base` | Always use `--base $BASE` |
| `git add -A` blindly | Check status first |
| Skip conflict check | Always run conflict-check.sh |
| Skip update branch | Merge when pr-check shows "behind" |

## Error Handling

| Error | Check | Fix |
|-------|-------|-----|
| `gh` fails | `gh auth status` | `gh auth login` |
| Push fails | `git remote -v` | `git remote add origin <url>` |

## References

- [Conflict Resolution Guide](references/conflict_resolution.md)
- [Evaluation Scenarios](references/evaluation.md)
- [Quick Start Checklist](QUICK_START.md)
