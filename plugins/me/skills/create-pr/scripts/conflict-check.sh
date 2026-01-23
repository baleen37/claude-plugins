#!/usr/bin/env bash
# Check for merge conflicts before pushing

set -euo pipefail

# Get base branch from argument or default to main
BASE="${1:-main}"

echo "# Checking for merge conflicts with $BASE"

# Fetch latest base branch
echo "Fetching latest $BASE..."
if ! git fetch origin "$BASE" 2>/dev/null; then
    echo "✗ Failed to fetch $BASE"
    exit 1
fi

# Check for conflicts without merging
echo
echo "# Merge conflict check"
MERGE_BASE=$(git merge-base HEAD "origin/$BASE" 2>/dev/null || echo "")

if [ -z "$MERGE_BASE" ]; then
    echo "✗ Could not find merge base with origin/$BASE"
    exit 1
fi

CONFLICTS=$(git merge-tree "$MERGE_BASE" HEAD "origin/$BASE" 2>&1 || true)

if [ -z "$CONFLICTS" ]; then
    echo "✓ No merge conflicts detected"
    exit 0
else
    echo "✗ Merge conflicts detected!"
    echo
    echo "Conflicted files:"
    echo "$CONFLICTS" | grep "CONFLICT" | sed 's/CONFLICT.*: //' || echo "$CONFLICTS"
    echo
    echo "Resolution steps:"
    echo "1. git merge origin/$BASE"
    echo "2. Resolve conflicts in files"
    echo "3. git add <resolved-files>"
    echo "4. git commit -m \"fix: resolve merge conflicts from $BASE\""
    echo
    echo "See references/conflict_resolution.md for detailed guide."
    exit 1
fi
