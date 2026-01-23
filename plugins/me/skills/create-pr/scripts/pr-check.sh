#!/usr/bin/env bash
# Gather all context needed for creating/updating a PR

set -euo pipefail

BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo "main")

echo "# Git Status"
git status --porcelain
echo "Current: $(git branch --show-current)"
echo "Base: $BASE"
echo

echo "# Branch Status"
git fetch origin "$BASE" 2>/dev/null || true

BEHIND=$(git rev-list --count HEAD..origin/"$BASE" 2>/dev/null || echo "0")
AHEAD=$(git rev-list --count origin/"$BASE"..HEAD 2>/dev/null || echo "0")

[ "$BEHIND" -gt 0 ] && echo "⚠️  $BEHIND commits behind origin/$BASE (consider: git merge origin/$BASE)" || echo "✓ Up to date with origin/$BASE"
[ "$AHEAD" -gt 0 ] && echo "✓ $AHEAD commits ahead"
echo

echo "# Conflict Check"
if MERGE_BASE=$(git merge-base HEAD origin/"$BASE" 2>/dev/null); then
    if git merge-tree "$MERGE_BASE" HEAD origin/"$BASE" 2>&1 | grep -q "CONFLICT"; then
        echo "⚠️  Merge conflicts detected (run conflict-check.sh for details)"
    else
        echo "✓ No conflicts"
    fi
else
    echo "⚠️  Cannot check conflicts"
fi
echo

echo "# Commits & Diff"
git log --oneline origin/"$BASE"..HEAD
git diff origin/"$BASE"..HEAD --stat
echo

echo "# PR State"
gh pr view --json state,number,url,reviewDecision -q '{state: .state, number: .number, url: .url, reviewDecision: .reviewDecision}' 2>/dev/null || echo "NO_PR"
echo

echo "# PR Size"
DIFF_LINES=$(git diff origin/"$BASE"..HEAD --numstat 2>/dev/null | awk '{sum+=$1+$2} END {print sum+0}')
echo "$DIFF_LINES lines changed"
[ "$DIFF_LINES" -gt 250 ] && echo "⚠️  Large PR ($DIFF_LINES lines, recommended: <250)"
echo

echo "# PR Template"
find .github -maxdepth 2 -iname '*pull_request_template*' -type f 2>/dev/null | head -1 | xargs cat 2>/dev/null || echo "None"
