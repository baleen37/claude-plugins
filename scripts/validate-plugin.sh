#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Claude Plugin Validation ==="

# Validate structure
echo "Validating plugin structure..."
bash "$SCRIPT_DIR/validate-structure.sh" || exit 1

# Validate JSON files
echo "Validating JSON files..."
bash "$SCRIPT_DIR/validate-json.sh" || exit 1

# Validate frontmatter
echo "Validating YAML frontmatter..."
python3 "$SCRIPT_DIR/validate-frontmatter.py" || exit 1

# Validate naming conventions
echo "Validating naming conventions..."
bash "$SCRIPT_DIR/validate-naming.sh" || exit 1

# Validate paths
echo "Validating paths..."
bash "$SCRIPT_DIR/validate-paths.sh" || exit 1

echo "=== All validations passed! ==="
