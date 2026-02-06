#!/usr/bin/env bash

set -euo pipefail

load_config() {
  # Get the directory where this script is located
  local lib_dir
  lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # config.json is in the plugin root (lib/../ -> scripts/, then scripts/../ -> plugin root)
  local config_file="${lib_dir}/../../config.json"
  local default_config='{"marketplaces":[{"name":"baleen-plugins"}]}'

  # Return default if config file doesn't exist
  if [[ ! -f "$config_file" ]]; then
    echo "$default_config"
    return 0
  fi

  # Try to parse config file, fall back to default on error
  local config_content
  if ! config_content=$(jq -c '.' "$config_file" 2>/dev/null); then
    echo "Warning: Failed to parse $config_file, using default config" >&2
    echo "$default_config"
    return 0
  fi

  echo "$config_content"
}

# Get org/repo for a marketplace by name
# Args: marketplace_name
# Returns: "org/repo" or empty string if not found
get_org_repo_for_marketplace() {
  local marketplace_name="$1"

  case "$marketplace_name" in
    "baleen-plugins")
      echo "baleen37/claude-plugins"
      ;;
    *)
      # Unknown marketplace
      echo ""
      ;;
  esac
}

get_plugins_for_marketplace() {
  local config_json="$1"
  local marketplace_name="$2"

  # Find the marketplace by name and extract plugins field
  local plugins
  plugins=$(echo "$config_json" | jq -r --arg name "$marketplace_name" \
    '.marketplaces[] | select(.name == $name) | .plugins // ""')

  echo "$plugins"
}
