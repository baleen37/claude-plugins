#!/bin/bash
set -euo pipefail

# Validate skill directory names
find . -path "*/skills/*" -maxdepth 1 -type d 2>/dev/null | while read -r dir; do
    dirname=$(basename "$dir")
    if [ "$dirname" != "skills" ]; then
        if [[ ! "$dirname" =~ ^[a-z0-9-]+$ ]]; then
            echo "❌ Invalid skill directory name: $dirname"
            exit 1
        fi
    fi
done

# Validate agent file names
find . -path "*/agents/*.md" -type f 2>/dev/null | while read -r file; do
    filename=$(basename "$file" .md)
    if [[ ! "$filename" =~ ^[a-z0-9-]+$ ]]; then
        echo "❌ Invalid agent filename: $filename"
        exit 1
    fi
done

echo "✓ Naming conventions valid"
