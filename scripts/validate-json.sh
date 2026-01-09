#!/bin/bash
set -euo pipefail

find . -name "*.json" -type f | while read -r file; do
    if ! jq empty "$file" 2>/dev/null; then
        echo "❌ Invalid JSON: $file"
        exit 1
    fi
done
echo "✓ JSON files valid"
