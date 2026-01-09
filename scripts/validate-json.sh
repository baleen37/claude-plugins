#!/bin/bash
set -euo pipefail

echo "=== Validating JSON files ==="

# 기존 JSON 유효성 검사
find . -name "*.json" -type f | while read -r file; do
    if ! jq empty "$file" 2>/dev/null; then
        echo "❌ Invalid JSON: $file"
        exit 1
    fi
done

# plugin.json 필수 필드 검증
plugin_json="plugins/example-plugin/.claude-plugin/plugin.json"
if [ -f "$plugin_json" ]; then
    required_fields=("name" "description" "version" "author")
    for field in "${required_fields[@]}"; do
        if ! jq -e ".${field}" "$plugin_json" > /dev/null; then
            echo "❌ Missing field '${field}' in $plugin_json"
            exit 1
        fi
    done
    # name 필드 정규식 검증 (소문자/숫자/하이픈만 허용)
    name=$(jq -r ".name" "$plugin_json")
    if ! [[ "$name" =~ ^[a-z0-9-]+$ ]]; then
        echo "❌ Invalid name format: $name"
        exit 1
    fi
fi

# marketplace.json 필수 필드 검증
marketplace_json=".claude-plugin/marketplace.json"
if [ -f "$marketplace_json" ]; then
    if ! jq -e ".name" "$marketplace_json" > /dev/null; then
        echo "❌ Missing field 'name' in $marketplace_json"
        exit 1
    fi
    if ! jq -e ".owner.name" "$marketplace_json" > /dev/null; then
        echo "❌ Missing field 'owner.name' in $marketplace_json"
        exit 1
    fi
    if ! jq -e ".plugins" "$marketplace_json" > /dev/null; then
        echo "❌ Missing field 'plugins' in $marketplace_json"
        exit 1
    fi
fi

echo "✓ JSON files valid"
