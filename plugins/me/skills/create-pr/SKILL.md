---
name: create-pr
description: Use when user asks to create PR, commit and push, or mentions being ready to merge - handles conflicts, protected branches, and merge-ready verification
---

# Create PR

Complete git workflow: commit → push → PR → verify merge-ready.

**Core principle:** Verify before every transition. Smart defaults, no unnecessary options.

**Announce at start:** "I'm using the create-pr skill to handle the complete git workflow."

## Red Flags - STOP

**Critical mistakes:**
- No `--base` flag → wrong target branch
- Skip conflict check → breaks remote
- Stop at PR creation → not verified merge-ready
- `git add` without `git status` → adds unintended files
- Proceed from main/master → violates protection
- **No changes to commit** → inform user, don't proceed

**Rationalizations (all wrong):**
- "Push/CI will catch it" → You verify, no assumptions
- "Time pressure" → Skipping verification costs hours of fixes
- "Base hasn't changed" → Always re-verify after updates
- "User is urgent/exhausted" → Fatigue increases risk, not decreases it
- "User ordered me to skip it" → You call out bad ideas, don't execute them

## Workflow

### 1. Pre-flight
- Check state: `git status`, `git log`, current branch
- **Block if on main/master** - create feature branch first
- **Block if no changes** - inform user working tree is clean

### 2. Commit
- Review: `git status`, `git diff --stat`
- Stage specific files only (never `-A`)
- Conventional commits + Co-Authored-By

### 3. Pre-push
- Detect base: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`
- **Conflict check:** `scripts/check-conflicts.sh "$BASE"` (REQUIRED)

### 4. Push
- `git push -u origin HEAD`

### 5. Create PR
- Generate body: `git log origin/"$BASE"..HEAD`
- `gh pr create --base "$BASE"` (always specify `--base`)

### 6. Verify Merge-Ready
**CRITICAL:** Don't stop at PR creation.

```bash
scripts/verify-pr-status.sh "$BASE"
```

Handles: CLEAN+CI checks, BEHIND (auto-update, max 3 retries), DIRTY (conflict detection)

## Scripts

- **scripts/check-conflicts.sh** - Pre-push conflict detection
- **scripts/verify-pr-status.sh** - PR status verification with BEHIND retry

## Out of Scope

This skill handles current branch state → push → PR → verify.

Does NOT handle:
- Git history cleanup (use manual rebase or GitHub squash merge)
- Debug code removal (clean up first, then use skill)
- Interactive rebase (technically unsupported)
- Commit message rewriting (amend before using skill)

**Clarification:** Multiple commits are fine - PR includes all commits since branch diverged from base.

## Integration

**Called by:** `/create-pr` command, after completing work

**Pairs with:**
- **verification-before-completion** - REQUIRED before this workflow
- **finishing-a-development-branch** - REQUIRED after PR merged

## Additional Resources

For detailed step-by-step workflow with examples, see **`references/workflow.md`**.

## Notes

- Smart defaults handle 95% of cases
- Every transition has verification
- Main/master protection is non-negotiable
- CI checks are mandatory (not optional)
