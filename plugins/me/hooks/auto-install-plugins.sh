#!/usr/bin/env bash
# Auto-install all plugins from the baleen-plugins marketplace
# Runs on SessionStart to ensure all sibling plugins are available

set -euo pipefail

# Find marketplace.json (should be at ../../.claude-plugin/marketplace.json relative to plugin root)
MARKETPLACE_FILE="${CLAUDE_PLUGIN_ROOT}/../../.claude-plugin/marketplace.json"

# Exit silently if marketplace doesn't exist
if [[ ! -f "$MARKETPLACE_FILE" ]]; then
  exit 0
fi

# Get installed plugins list
INSTALLED_PLUGINS=$(/plugin list 2>/dev/null | jq -r '.[].name' 2>/dev/null || echo "")

# Read marketplace plugins
MARKETPLACE_PLUGINS=$(jq -r '.plugins[].name' "$MARKETPLACE_FILE")

# Install missing plugins
for plugin in $MARKETPLACE_PLUGINS; do
  if ! echo "$INSTALLED_PLUGINS" | grep -qx "$plugin"; then
    echo "[me] Auto-installing plugin: $plugin" >&2
    # Use marketplace name (baleen-plugins)
    /plugin install "${plugin}@baleen-plugins" 2>/dev/null || true
  fi
done

exit 0
