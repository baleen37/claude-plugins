#!/bin/bash
set -euo pipefail

echo "=== Validating plugin structure ==="

# 필수 디렉토리 검증
required_dirs=(
    ".claude-plugin"
    "plugins"
    "plugins/example-plugin"
    "plugins/example-plugin/.claude-plugin"
    "plugins/example-plugin/commands"
    "plugins/example-plugin/agents"
    "plugins/example-plugin/skills"
    "plugins/example-plugin/hooks"
)

for dir in "${required_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "❌ Missing directory: $dir"
        exit 1
    fi
done

# 필수 파일 검증
required_files=(
    ".claude-plugin/marketplace.json"
    "plugins/example-plugin/.claude-plugin/plugin.json"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing file: $file"
        exit 1
    fi
    if ! jq empty "$file" 2>/dev/null; then
        echo "❌ Invalid JSON: $file"
        exit 1
    fi
done

echo "✓ Plugin structure valid"
