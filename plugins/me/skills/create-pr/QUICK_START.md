# Quick Start Checklist

Fast reference for create-pr skill workflow.

---

## Pre-Flight

- [ ] `gh auth status` - Authenticated?
- [ ] `git remote -v` - Remote configured?
- [ ] `git branch --show-current` - On correct branch?

---

## 5-Step Workflow

### 1. Gather Context
```bash
bash {baseDir}/scripts/pr-check.sh
```
- [ ] Note BASE branch
- [ ] Note PR state (OPEN/NO_PR/MERGED/CLOSED)

### 2. Check Conflicts
```bash
bash {baseDir}/scripts/conflict-check.sh $BASE
```
- [ ] Exit 0? → Proceed to step 3
- [ ] Exit 1? → Resolve conflicts (see references/conflict_resolution.md)

### 3. Create WIP Branch (if on main/master)
```bash
git checkout -b wip/<description>
```
- [ ] Only if currently on main or master

### 4. Commit
```bash
git status
git add <specific-files>
git commit -m "feat: description"
```
- [ ] Used specific files (not `git add -A` unless verified)
- [ ] Conventional Commits format

### 5. Push & PR

```bash
git push -u origin HEAD
```

**By PR state:**

| State | Command |
|-------|---------|
| OPEN | `gh pr edit --title "$TITLE" --body "$BODY"` |
| NO_PR/MERGED | `gh pr create --base $BASE [--draft] --title "$TITLE" --body "$BODY"` |
| CLOSED | Ask user first |

- [ ] Used `--base $BASE`
- [ ] PR body has Summary + Test plan

---

## Red Flags

- ❌ Omit `--base` flag
- ❌ `git add -A` without `git status` first
- ❌ Skip conflict check
- ❌ Assume no existing PR
- ❌ Commit directly to main/master

---

## PR Body Template

```markdown
## Summary
- Change 1 (from commits)
- Change 2 (from commits)

## Test plan
- [x] Tests pass
- [x] Manual verification
```
