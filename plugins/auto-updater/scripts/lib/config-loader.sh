#!/usr/bin/env bash
#
# config-loader.sh
# Load and parse configuration for auto-updater
#

set -euo pipefail

# Default configuration
DEFAULT_MARKETPLACE_SOURCE="baleen37/claude-plugins"
DEFAULT_MARKETPLACE_NAME="baleen-plugins"

# Create default configuration file
create_default_config() {
  local config_file="$1"

  mkdir -p "$(dirname "$config_file")"
  cat > "$config_file" << EOF
{
  "marketplaces": [
    {
      "name": "$DEFAULT_MARKETPLACE_NAME",
      "source": "$DEFAULT_MARKETPLACE_SOURCE"
    }
  ]
}
EOF
}

# Load and validate configuration
load_config() {
  local config_file="$1"

  # Create default config if missing
  if [ ! -f "$config_file" ]; then
    create_default_config "$config_file"
  fi

  # Validate config has marketplaces array
  if ! jq -e '.marketplaces' "$config_file" >/dev/null 2>&1; then
    echo "Invalid config.json: missing 'marketplaces' array" >&2
    return 1
  fi
}

# Get all marketplaces as JSON lines
get_marketplaces() {
  local config_file="$1"

  jq -c '.marketplaces[]' "$config_file" 2>/dev/null || echo ""
}

# Get marketplace URL from source (GitHub owner/repo)
get_marketplace_url() {
  local marketplace_json="$1"
  local source

  source=$(echo "$marketplace_json" | jq -r '.source // empty')
  if [ -n "$source" ]; then
    echo "https://raw.githubusercontent.com/${source}/main/.claude-plugin/marketplace.json"
    return 0
  fi

  return 1
}

# Check if a plugin should be installed based on marketplace config
# Returns 0 if plugin should be installed, 1 otherwise
# Uses 'include' field: if omitted or "all", install all plugins
# If array, only install plugins in the list
should_install_plugin() {
  local marketplace_json="$1"
  local plugin_name="$2"
  local plugins_config

  plugins_config=$(echo "$marketplace_json" | jq -r '.plugins // "all"')

  # Omitted or "all" means install all plugins from this marketplace
  if [ "$plugins_config" = "all" ] || [ "$plugins_config" = "null" ]; then
    return 0
  fi

  # Array: check if plugin name is in the list
  if echo "$plugins_config" | jq -e '.[]' >/dev/null 2>&1; then
    echo "$plugins_config" | jq -r --arg name "$plugin_name" '.[] | select(. == $name)' | grep -q "$plugin_name"
    return $?
  fi

  return 1
}

# Get marketplace name from JSON
get_marketplace_name() {
  local marketplace_json="$1"
  echo "$marketplace_json" | jq -r '.name'
}
