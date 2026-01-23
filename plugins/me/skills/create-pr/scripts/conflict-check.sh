#!/usr/bin/env bash
# Check for merge conflicts before pushing

set -euo pipefail

# Get base branch from argument or default to main
BASE="${1:-main}"

echo "# Checking for merge conflicts with $BASE"

# Fetch latest base branch
echo "Fetching latest $BASE..."
if ! git fetch origin "$BASE" 2>/dev/null; then
    echo "✗ Failed to fetch $BASE" >&2
    exit 1
fi

# Check for conflicts without merging
echo
echo "# Merge conflict check"
MERGE_BASE=$(git merge-base HEAD "origin/$BASE" 2>/dev/null || echo "")

if [ -z "$MERGE_BASE" ]; then
    echo "✗ Could not find merge base with origin/$BASE" >&2
    exit 1
fi

CONFLICTS=$(git merge-tree "$MERGE_BASE" HEAD "origin/$BASE" 2>&1 || true)

# Check for actual conflict indicators:
# - "changed in both" indicates both sides modified the same file
# - "added in both" with conflict markers indicates both sides added same file with different content
# - "^+<<<<<<< " indicates conflict markers in the diff output (with + prefix from diff)
if echo "$CONFLICTS" | grep -q "^changed in both" || echo "$CONFLICTS" | grep -q "^+<<<<<<< "; then
    echo "✗ Merge conflicts detected!" >&2
    echo
    echo "Conflicted files:"
    # Extract filenames from "changed in both" blocks
    # Format is:
    #   changed in both
    #     base   100644 HASH filename
    #     our    100644 HASH filename
    #     their  100644 HASH filename
    if echo "$CONFLICTS" | grep -q "^changed in both"; then
        echo "$CONFLICTS" | grep -A1 "^changed in both" | grep "  base  " | awk '{print $NF}'
    fi

    # Also check for "added in both" with conflict markers
    # Format is:
    #   added in both
    #     our    100644 HASH filename
    #     their  100644 HASH filename
    if echo "$CONFLICTS" | grep -q "^added in both"; then
        # Check if there are conflict markers in the diff (with + prefix)
        if echo "$CONFLICTS" | grep -q "^+<<<<<<< "; then
            echo "$CONFLICTS" | grep -A1 "^added in both" | grep "  our  " | awk '{print $NF}'
        fi
    fi
    echo
    echo "Resolution steps:"
    echo "1. git merge origin/$BASE"
    echo "2. Resolve conflicts in files"
    echo "3. git add <resolved-files>"
    echo "4. git commit -m \"fix: resolve merge conflicts from $BASE\""
    echo
    echo "See references/conflict_resolution.md for detailed guide."
    exit 1
else
    echo "✓ No merge conflicts detected"
    exit 0
fi
