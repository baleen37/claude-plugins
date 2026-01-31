#!/usr/bin/env bash
set -eo pipefail

# Default configuration
CONFIG_DIR="${CONFIG_DIR:-$HOME/.claude/auto-updater}"
TIMESTAMP_FILE="$CONFIG_DIR/last-check"
CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
MARKETPLACE_FILE="${MARKETPLACE_FILE:-}"

# Use default marketplace path if not set
if [[ -z "$MARKETPLACE_FILE" && -n "$CLAUDE_PLUGIN_ROOT" ]]; then
  MARKETPLACE_FILE="$CLAUDE_PLUGIN_ROOT/.claude-plugin/marketplace.json"
fi

# Ensure config directory exists
mkdir -p "$CONFIG_DIR"

# Parse arguments
CHECK_ONLY=false
SILENT=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --check-only)
      CHECK_ONLY=true
      shift
      ;;
    --silent)
      SILENT=true
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Update timestamp before early exit if not check-only
if [[ "$CHECK_ONLY" = false ]]; then
  date +%s > "$TIMESTAMP_FILE"
fi

# Exit silently if marketplace doesn't exist (timestamp already updated)
if [[ -z "$MARKETPLACE_FILE" || ! -f "$MARKETPLACE_FILE" ]]; then
  exit 0
fi

# Get installed plugins
if command -v claude &> /dev/null; then
  INSTALLED_PLUGINS=$(claude plugin list --json 2>/dev/null || echo "[]")
else
  INSTALLED_PLUGINS="[]"
fi

# Check for outdated plugins
OUTDATED_COUNT=0

if [[ "$INSTALLED_PLUGINS" != "[]" ]]; then
  # Parse installed plugins and check against marketplace
  while IFS= read -r plugin; do
    PLUGIN_ID=$(echo "$plugin" | jq -r '.id // empty' 2>/dev/null || echo "")
    PLUGIN_VERSION=$(echo "$plugin" | jq -r '.version // empty' 2>/dev/null || echo "")

    if [[ -n "$PLUGIN_ID" && -n "$PLUGIN_VERSION" ]]; then
      # Extract plugin name from ID (format: name@source)
      PLUGIN_NAME="${PLUGIN_ID%%@*}"

      # Check marketplace for newer version
      MARKETPLACE_VERSION=$(jq -r --arg name "$PLUGIN_NAME" \
        '.plugins[] | select(.name == $name) | .version' \
        "$MARKETPLACE_FILE" 2>/dev/null || echo "")

      if [[ -n "$MARKETPLACE_VERSION" && "$MARKETPLACE_VERSION" != "$PLUGIN_VERSION" ]]; then
        if [[ "$SILENT" = false ]]; then
          echo "Plugin $PLUGIN_NAME: installed $PLUGIN_VERSION, available $MARKETPLACE_VERSION"
        fi
        OUTDATED_COUNT=$((OUTDATED_COUNT + 1))
      fi
    fi
  done < <(echo "$INSTALLED_PLUGINS" | jq -c '.[]' 2>/dev/null || echo "")
fi

# Summary output
if [[ "$SILENT" = false && "$OUTDATED_COUNT" -gt 0 ]]; then
  echo "Found $OUTDATED_COUNT outdated plugin(s)"
elif [[ "$SILENT" = false ]]; then
  echo "All plugins up to date"
fi

exit 0
