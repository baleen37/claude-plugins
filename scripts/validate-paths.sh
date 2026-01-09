#!/bin/bash
set -euo pipefail

# Check for hardcoded absolute paths (excluding .git)
grep -rE '(^|[^$])/([a-z]|home|Users|tmp)' . \
    --include="*.json" \
    --include="*.sh" \
    --include="*.md" \
    --exclude-dir=".git" \
    2>/dev/null || true

if grep -q "\${CLAUDE_PLUGIN_ROOT}" . 2>/dev/null; then
    echo "✓ Using \${CLAUDE_PLUGIN_ROOT} for portability"
fi

echo "✓ Path validation complete"
