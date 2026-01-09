#!/bin/bash
set -euo pipefail

# Read input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // ""')

# Validate
if [[ "$FILE_PATH" == *".."* ]]; then
  echo '{"block": true, "reason": "Path traversal detected"}' >&2
  exit 1
fi

if [[ "$FILE_PATH" == *".env"* ]] || [[ "$FILE_PATH" == *".key"* ]] || [[ "$FILE_PATH" == *".secret"* ]]; then
  echo '{"block": true, "reason": "Attempting to write to sensitive file"}' >&2
  exit 1
fi

# Allow the operation
echo '{"block": false}'
