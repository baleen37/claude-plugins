---
name: create-pr
description: Complete git workflow: commit → push → PR → verify merge-ready. Handles conflicts, protected branches, and merge-ready verification
argument-hint: ""
allowed-tools: Bash(*)
---

# Create PR

Complete git workflow with verification at every transition.

**Announce at start:** "I'm using /create-pr to handle the complete git workflow."

## Red Flags - STOP

**Critical mistakes:**

- No `--base` flag → wrong target branch
- Skip conflict check → breaks remote
- Stop at PR creation → not verified merge-ready
- `git add` without `git status` → adds unintended files
- Proceed from main/master → violates protection
- **No changes to commit** → inform user, don't proceed

## Workflow

### 1. Pre-flight

```bash
git status
git log --oneline -5
git branch --show-current
```

- **Block if on main/master** - create feature branch first
- **Block if no changes** - inform user working tree is clean

### 2. Commit

```bash
git status
git diff --stat
# Stage specific files only (never -A)
git add <files>
git commit -m "type(scope): description"
```

### 3. Pre-push

```bash
BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
# Conflict check (REQUIRED)
"${CLAUDE_PLUGIN_ROOT}/scripts/check-conflicts.sh" "$BASE"
```

### 4. Push

```bash
git push -u origin HEAD
```

### 5. Create PR

```bash
# Generate body from commits
gh pr create --base "$BASE" --title "$(git log -1 --pretty=%s)"
```

### 6. Verify Merge-Ready (CRITICAL)

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/verify-pr-status.sh" "$BASE"
```

Handles: CLEAN+CI checks, BEHIND (auto-update, max 3 retries), DIRTY (conflict detection)
