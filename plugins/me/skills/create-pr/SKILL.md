---
name: create-pr
description: Use when user asks to create PR, commit and push, or mentions being ready to merge - handles conflicts, protected branches, and merge-ready verification
---

# Create PR

Complete git workflow: commit → push → PR → verify merge-ready.

**Core principle:** Verify before every transition. Smart defaults, no unnecessary options.

**Announce at start:** "I'm using the create-pr skill to handle the complete git workflow."

## Red Flags - STOP

Stop if you:
- Don't know which base branch to use
- Skipped conflict check before push
- Said "push will catch conflicts" or "push will detect it"
- Used `git add` without first running `git status`
- Created PR but didn't check status afterward
- Stopped at PR creation without verifying merge-ready
- Said "GitHub will notify" or "CI will catch it"
- Said "just pushed so base hasn't changed"
- Said "I detected the issue but..." (detection without blocking)
- Said "user requested it" to bypass protected branch check
- Said "time pressure" or "user is urgent/exhausted" to skip verification

**All of these mean: Follow complete workflow.**

## Quick Reference

| Step | Command | Notes |
|------|---------|-------|
| Status | `git status && git log --oneline -5` | Always first |
| Add | `git add path/to/file` | Specific files only |
| Commit | `git commit -m "type: description"` | Conventional commits |
| Base branch | `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` | Never assume |
| Conflict check | `git fetch origin <base> && git merge-tree $(git merge-base HEAD origin/<base>) HEAD origin/<base>` | Exit 0 = clean |
| Push | `git push -u origin HEAD` | After conflict check |
| Create PR | `gh pr create --base <base> --title "..." --body "..."` | Always `--base` |
| PR status | `gh pr view --json mergeable,mergeStateStatus` | CLEAN/BEHIND/DIRTY |
| Update branch | `git merge origin/<base> --no-edit && git push` | When BEHIND |

## Workflow Steps

### Phase 1: Pre-flight Checks

**1.1 Verify Current State**

```bash
# Run in parallel
git status &
git log --oneline -5 &
git branch --show-current &
wait
```

**1.2 Main Branch Protection**

```bash
CURRENT_BRANCH=$(git branch --show-current)

if [[ "$CURRENT_BRANCH" == "main" ]] || [[ "$CURRENT_BRANCH" == "master" ]]; then
  ERROR: Cannot create PR from protected branch '$CURRENT_BRANCH'

  SOLUTION:
  1. Create feature branch: git checkout -b feature/your-feature
  2. Or create WIP branch: git checkout -b wip/$(date +%Y%m%d)

  exit 1
fi
```

**Never proceed from main/master.** This protects against accidental direct commits.

### Phase 2: Commit Changes

**2.1 Review Changes**

```bash
git status
git diff --stat
```

**2.2 Stage Files**

```bash
# NEVER use: git add -A or git add .
# ALWAYS stage specific files:
git add path/to/file1 path/to/file2
```

**2.3 Create Commit**

```bash
# Use conventional commits format
git commit -m "$(cat <<'EOF'
type(scope): description

Optional body explaining why this change was made.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

### Phase 3: Pre-push Verification

**3.1 Detect Base Branch**

Priority order:

```bash
# 1. Try default branch (primary method)
BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null)

# 2. Try recent PR base (fallback)
if [[ -z "$BASE" ]]; then
  BASE=$(gh pr list --limit 1 --json baseRefName -q '.[0].baseRefName' 2>/dev/null)
fi

# 3. Ask user (last resort)
if [[ -z "$BASE" ]]; then
  echo "ERROR: Cannot determine base branch"
  echo "Please specify base branch manually"
  exit 1
fi
```

**Never assume base branch name.** User saying "main like always" doesn't override verification.

**3.2 Check for Conflicts**

**REQUIRED.** Takes 5 seconds. Prevents hours of debugging broken remote.

```bash
# Fetch latest base
git fetch origin "$BASE"

# Check for merge conflicts
git merge-tree $(git merge-base HEAD origin/"$BASE") HEAD origin/"$BASE"

if [[ $? -ne 0 ]]; then
  # Conflicts detected
  echo "WARNING: Conflicts detected with origin/$BASE"

  # Auto-resolve whitespace-only conflicts
  if git diff origin/"$BASE"...HEAD | grep -q "^[-+]\s*$"; then
    echo "Auto-resolving: whitespace only"
    # Proceed
  else
    echo "ERROR: Logic conflicts require manual resolution"
    echo "Run: git merge origin/$BASE"
    exit 1
  fi
fi
```

### Phase 4: Push

```bash
git push -u origin HEAD

# Verify push succeeded
if [[ $? -ne 0 ]]; then
  echo "ERROR: Push failed"

  # Common causes
  if ! git remote get-url origin >/dev/null 2>&1; then
    echo "No remote 'origin' configured"
    echo "Add with: git remote add origin <url>"
  fi

  exit 1
fi
```

### Phase 5: Create PR

**5.1 Generate PR Body**

```bash
# Extract commits since branching from base
COMMITS=$(git log --oneline origin/"$BASE"..HEAD)

# Generate summary from commits
cat > /tmp/pr-body.md <<EOF
## Summary
$(echo "$COMMITS" | sed 's/^[a-f0-9]* /- /')

## Test plan
- [ ] Tests pass
- [ ] Manual verification done
EOF
```

**5.2 Create PR**

```bash
gh pr create \
  --base "$BASE" \
  --title "$(git log -1 --pretty=%s)" \
  --body "$(cat /tmp/pr-body.md)"
```

**Always specify `--base` explicitly.**

### Phase 6: Verify Merge-Ready

**6.1 Check PR Status**

```bash
PR_STATUS=$(gh pr view --json mergeable,mergeStateStatus)

MERGEABLE=$(echo "$PR_STATUS" | jq -r .mergeable)
STATE=$(echo "$PR_STATUS" | jq -r .mergeStateStatus)
```

**6.2 Handle Status**

```bash
case "$STATE" in
  CLEAN)
    echo "✓ PR is merge-ready"
    ;;

  BEHIND)
    echo "Branch is behind $BASE, updating..."
    git merge origin/"$BASE" --no-edit
    git push

    # Re-check status
    # (repeat 6.1)
    ;;

  DIRTY)
    echo "ERROR: Conflicts detected after PR creation"
    echo "Resolve manually and re-push"
    exit 1
    ;;

  *)
    echo "WARNING: Unknown status '$STATE'"
    ;;
esac
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot create PR from main" | On protected branch | `git checkout -b feature/name` |
| "Cannot determine base branch" | No default branch detected | Specify with `gh repo view` |
| "Push failed: no remote" | Missing origin | `git remote add origin <url>` |
| "Conflicts detected" | Changes conflict with base | `git merge origin/<base>` then resolve |
| "PR status: BEHIND" | Base branch updated | Auto-merged and re-pushed |
| "PR status: DIRTY" | Conflicts after PR creation | Manual resolution required |
| "gh: command not found" | GitHub CLI not installed | Install: `brew install gh` |
| "gh: authentication failed" | Not logged in | `gh auth login` |

## Common Mistakes

| Mistake | Why Bad | Fix |
|---------|---------|-----|
| Omit `--base` flag | PR goes to wrong branch | Always specify explicitly |
| `git add -A` blindly | Adds unintended files | Run `git status` first |
| Skip conflict check | Breaks remote build | Always check before push |
| Assume base = main | Repos use different names | Verify via `gh repo view` |
| Stop after PR creation | May not be merge-ready | Check status, handle BEHIND |
| Proceed from main | Violates workflow | Block with error |

## Rationalizations to Reject

| Rationalization | Reality |
|-----------------|---------|
| "Push will catch conflicts" | Conflicts break remote for entire team. Check takes 5 seconds. |
| "CI will catch it" | PR creation ≠ merge-ready. Always verify status. |
| "GitHub will notify" | You create it, you verify it. No assumptions. |
| "Time pressure = skip verification" | Fast ≠ wrong. Parallel execution = both fast AND correct. Overhead: <10 seconds. Cost of skipping: hours. |
| "I detected the issue" | Detection without blocking = failure. If you see a problem, STOP. |
| "User requested it" (for protected branch) | Protected branch rules exist for a reason. Block anyway. |
| "User is exhausted/urgent" | Fatigue increases mistake risk. Extra vigilance required, not less. |

## Integration

**Called by:**
- User explicitly: `/create-pr` command
- After completing implementation work
- When ready to submit changes for review

**Pairs with:**
- **verification-before-completion** - REQUIRED before starting this workflow
- **finishing-a-development-branch** - REQUIRED for cleanup after PR merged

## Notes

- No optional flags except those explicitly documented
- Smart defaults handle 95% of cases
- Clear errors guide remaining 5%
- Every transition has verification
- Main/master protection is non-negotiable
