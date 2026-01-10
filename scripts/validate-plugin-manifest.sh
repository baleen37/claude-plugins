#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Claude Code plugin.json 허용된 필드만 검증
# https://code.claude.com/docs/en/plugins-reference#plugin-manifest

echo "Validating plugin manifests..."

# 허용된 필드 목록 (Claude Code 공식 문서 기준)
ALLOWED_FIELDS=(
  "name"
  "description"
  "author"
  "version"
  "license"
  "homepage"
  "repository"
  "keywords"
)

# 허용된 중첩 필드
ALLOWED_NESTED_FIELDS=(
  "author.name"
  "author.email"
)

error_count=0

find "$PROJECT_ROOT/plugins" -name "plugin.json" -type f | while read -r manifest_file; do
  plugin_dir=$(dirname "$manifest_file")
  plugin_name=$(basename "$(dirname "$plugin_dir")")

  # jq로 모든 키 추출
  all_keys=$(jq -r 'keys_unsorted[]' "$manifest_file" 2>/dev/null || true)

  if [[ -z "$all_keys" ]]; then
    echo "❌ Error: Cannot parse $manifest_file"
    ((error_count++))
    continue
  fi

  # 허용되지 않은 필드 확인
  invalid_fields=()
  while IFS= read -r key; do
    # 허용된 필드 목록에 없는지 확인
    if [[ ! " ${ALLOWED_FIELDS[@]} " =~ " ${key} " ]]; then
      invalid_fields+=("$key")
    fi
  done <<< "$all_keys"

  if [[ ${#invalid_fields[@]} -gt 0 ]]; then
    echo "❌ Invalid fields in $manifest_file:"
    for field in "${invalid_fields[@]}"; do
      echo "   - $field"
    done
    echo "   Allowed fields: ${ALLOWED_FIELDS[*]}"
    ((error_count++))
  else
    echo "✓ $plugin_name/plugin.json"
  fi
done

# 중첩 필드 검증 (author 객체)
find "$PROJECT_ROOT/plugins" -name "plugin.json" -type f | while read -r manifest_file; do
  plugin_dir=$(dirname "$manifest_file")
  plugin_name=$(basename "$(dirname "$plugin_dir")")

  # author 필드의 키 추출
  author_keys=$(jq -r '.author | keys_unsorted[]' "$manifest_file" 2>/dev/null || true)

  if [[ -n "$author_keys" ]]; then
    invalid_author_fields=()
    while IFS= read -r key; do
      if [[ ! " name email " =~ " ${key} " ]]; then
        invalid_author_fields+=("author.$key")
      fi
    done <<< "$author_keys"

    if [[ ${#invalid_author_fields[@]} -gt 0 ]]; then
      echo "❌ Invalid nested fields in $manifest_file:"
      for field in "${invalid_author_fields[@]}"; do
        echo "   - $field"
      done
      echo "   Allowed author fields: name, email"
      ((error_count++))
    fi
  fi
done

if [[ $error_count -gt 0 ]]; then
  echo ""
  echo "❌ Plugin manifest validation failed with $error_count error(s)"
  echo ""
  echo "Claude Code plugin.json only supports these fields:"
  echo "  - name (required)"
  echo "  - description"
  echo "  - author (object with name, email)"
  echo "  - version"
  echo "  - license"
  echo "  - homepage"
  echo "  - repository"
  echo "  - keywords"
  echo ""
  echo "See: https://code.claude.com/docs/en/plugins-reference#plugin-manifest"
  exit 1
fi

echo "✓ All plugin manifests are valid"
exit 0
