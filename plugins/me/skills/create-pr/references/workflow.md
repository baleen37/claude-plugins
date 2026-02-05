# Detailed Workflow

Complete step-by-step git workflow for creating pull requests.

## Phase 1: Pre-flight Checks

### 1.1 Verify Current State

Run these commands in parallel to gather initial state:

```bash
git status &
git log --oneline -5 &
git branch --show-current &
wait
```

### 1.2 Check for Changes

If `git status` shows "nothing to commit, working tree clean":

```
INFORM USER: "No changes to commit. Working tree is clean."

OPTIONS:
- If you meant to commit different work, switch to that branch
- If you need to make changes first, complete your work then retry
- If you want to create a PR from existing commits, use 'gh pr create' directly
```

STOP and wait for user direction. Do not proceed.

### 1.3 Main Branch Protection

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

Never proceed from main/master. This protects against accidental direct commits.

### 1.4 Pre-commit Hook Check

Before committing, inform user:

```
NOTE: This project has pre-commit hooks (markdownlint, etc.).
If commit fails due to hook errors, I can fix them automatically.
Would you like me to proceed and fix any lint issues?
```

If user confirms, proceed with commit. If hooks fail:

1. Parse error output to identify issues
2. Fix issues automatically (formatting, line length, etc.)
3. Stage fixed files
4. Retry commit

Do not ask for permission to fix hook errors if user already confirmed.

## Phase 2: Commit Changes

### 2.1 Review Changes

```bash
git status
git diff --stat
```

### 2.2 Stage Files

```bash
# NEVER use: git add -A or git add .
# ALWAYS stage specific files:
git add path/to/file1 path/to/file2
```

### 2.3 Create Commit

Use conventional commits format:

```bash
git commit -m "$(cat <<'EOF'
type(scope): description

Optional body explaining why this change was made.
EOF
)"
```

## Phase 3: Pre-push Verification

### 3.1 Detect Base Branch

Use this priority order:

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

Never assume base branch name. User saying "main like always" does not override verification.

### 3.2 Check for Conflicts

Required. Takes 5 seconds. Prevents hours of debugging broken remote.

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

## Phase 4: Push

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

## Phase 5: Create PR

### 5.1 Generate PR Body

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

### 5.2 Generate PR Title

```bash
# Use latest commit message as title
TITLE=$(git log -1 --pretty=%s)

# If no commits yet (shouldn't happen), use branch name
if [[ -z "$TITLE" ]]; then
  TITLE=$(git branch --show-current | sed 's/^[a-z]*\///')
fi
```

### 5.3 Create PR

```bash
gh pr create \
  --base "$BASE" \
  --title "$TITLE" \
  --body "$(cat /tmp/pr-body.md)"
```

Always specify `--base` explicitly.

## Phase 6: Verify Merge-Ready

### 6.1 Check PR Status

```bash
PR_STATUS=$(gh pr view --json mergeable,mergeStateStatus)

MERGEABLE=$(echo "$PR_STATUS" | jq -r .mergeable)
STATE=$(echo "$PR_STATUS" | jq -r .mergeStateStatus)
```

### 6.2 Handle Status

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
