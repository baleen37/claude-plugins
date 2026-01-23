#!/usr/bin/env bash
# Gather all context needed for creating/updating a PR

set -euo pipefail

# Get base branch
BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo "main")

echo "# Git Status"
git status --porcelain
CURRENT_BRANCH=$(git branch --show-current)
echo "Current: $CURRENT_BRANCH"
echo "Base: $BASE"
echo

# Fetch latest base to ensure we have up-to-date info
echo "# Branch Status"
git fetch origin "$BASE" 2>/dev/null || true

# Check if branch is up to date with base
BEHIND=$(git rev-list --count HEAD..origin/"$BASE" 2>/dev/null || echo "0")
AHEAD=$(git rev-list --count origin/"$BASE"..HEAD 2>/dev/null || echo "0")

if [ "$BEHIND" -gt 0 ]; then
    echo "⚠️  Branch is $BEHIND commits behind origin/$BASE"
    echo "   Consider: git merge origin/$BASE"
else
    echo "✓ Branch is up to date with origin/$BASE"
fi

if [ "$AHEAD" -gt 0 ]; then
    echo "✓ Branch is $AHEAD commits ahead"
fi
echo

# Quick conflict check
echo "# Conflict Check (Preview)"
MERGE_BASE=$(git merge-base HEAD origin/"$BASE" 2>/dev/null || echo "")
if [ -n "$MERGE_BASE" ]; then
    CONFLICT_OUTPUT=$(git merge-tree "$MERGE_BASE" HEAD origin/"$BASE" 2>&1 || true)
    if echo "$CONFLICT_OUTPUT" | grep -q "CONFLICT"; then
        CONFLICT_COUNT=$(echo "$CONFLICT_OUTPUT" | grep -c "CONFLICT" || echo "0")
        echo "⚠️  $CONFLICT_COUNT potential merge conflicts detected"
        echo "   Run conflict-check.sh for details"
    else
        echo "✓ No merge conflicts detected"
    fi
else
    echo "⚠️  Could not check conflicts (no merge base)"
fi
echo

echo "# Commits & Diff"
git log --oneline origin/"$BASE"..HEAD
git diff origin/"$BASE"..HEAD --stat
echo

echo "# PR State"
gh pr view --json state,number,url,reviewDecision -q '{state: .state, number: .number, url: .url, reviewDecision: .reviewDecision}' 2>/dev/null || echo "NO_PR"
echo

echo "# PR Size Check"
DIFF_LINES=$(git diff origin/"$BASE"..HEAD --numstat 2>/dev/null | awk '{sum+=$1+$2} END {print sum+0}')
echo "Changed lines: $DIFF_LINES"
if [ "$DIFF_LINES" -gt 250 ]; then
    echo "⚠️  WARNING: PR is $DIFF_LINES lines (recommended: <250)"
    echo "   Consider breaking into smaller PRs for faster review"
fi
echo

echo "# PR Template"
find .github -maxdepth 2 -iname '*pull_request_template*' -type f 2>/dev/null | head -1 | xargs cat 2>/dev/null || echo "None"
