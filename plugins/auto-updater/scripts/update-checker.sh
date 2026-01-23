#!/usr/bin/env bash

set -euo pipefail

# Load version comparison functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/version-compare.sh
source "${SCRIPT_DIR}/lib/version-compare.sh"

# Configuration
CONFIG_DIR="${HOME}/.claude/auto-updater"
TIMESTAMP_FILE="${CONFIG_DIR}/last-check"
LOG_FILE="${CONFIG_DIR}/update.log"
MARKETPLACE_CACHE="${CONFIG_DIR}/marketplace.json"
MARKETPLACE_URL="https://raw.githubusercontent.com/baleen37/claude-plugins/main/.claude-plugin/marketplace.json"

# Exit early if CLAUDE_PLUGIN_ROOT is not set
if [ -z "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  exit 0
fi

# Helper: fetch marketplace.json from GitHub
fetch_marketplace() {
  mkdir -p "$CONFIG_DIR"

  # Try to download from GitHub
  if curl -fsSL --max-time 10 "$MARKETPLACE_URL" -o "${MARKETPLACE_CACHE}.tmp" 2>/dev/null; then
    mv "${MARKETPLACE_CACHE}.tmp" "$MARKETPLACE_CACHE"
    return 0
  else
    # Download failed, clean up temp file
    rm -f "${MARKETPLACE_CACHE}.tmp"

    # Check if cached file exists
    if [ -f "$MARKETPLACE_CACHE" ]; then
      return 0
    else
      return 1
    fi
  fi
}

# Fetch marketplace.json (download or use cached)
fetch_marketplace || exit 0
MARKETPLACE_FILE="${MARKETPLACE_FILE:-$MARKETPLACE_CACHE}"

# Parse command line arguments
SILENT_MODE=false
CHECK_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --silent)
      SILENT_MODE=true
      ;;
    --check-only)
      CHECK_ONLY=true
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

# Helper: log message (always to file, optionally to stderr)
log() {
  local level="${1:-INFO}"
  shift
  local message="$*"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Ensure log directory exists
  mkdir -p "$CONFIG_DIR"

  # Always write to log file
  echo "[$timestamp] [$level] $message" >> "$LOG_FILE"

  # Write to stderr if not silent
  if [ "$SILENT_MODE" = false ]; then
    echo "[auto-updater] $message" >&2
  fi
}


# Helper: update timestamp
update_timestamp() {
  mkdir -p "$CONFIG_DIR"
  date +%s > "$TIMESTAMP_FILE" 2>/dev/null || true
}

# Exit silently if marketplace doesn't exist
if [ ! -f "$MARKETPLACE_FILE" ]; then
  exit 0
fi

# Update marketplace cache to get latest versions
if [ "$CHECK_ONLY" = false ]; then
  log INFO "Updating marketplace cache..."
  if ! claude plugin marketplace update baleen-plugins 2>/dev/null; then
    log ERROR "Failed to update marketplace cache"
  fi
fi

# Get installed plugins
INSTALLED_PLUGINS_JSON=$(claude plugin list --json 2>/dev/null || echo "[]")

# Read marketplace plugins
MARKETPLACE_PLUGINS=$(jq -c '.plugins[] | {name: .name, version: .version}' "$MARKETPLACE_FILE" 2>/dev/null || echo "")

if [ -z "$MARKETPLACE_PLUGINS" ]; then
  log WARN "No plugins found in marketplace"
  exit 0
fi

# Process each marketplace plugin
while IFS= read -r plugin_json; do
  plugin_name=$(echo "$plugin_json" | jq -r '.name')
  marketplace_version=$(echo "$plugin_json" | jq -r '.version')

  # Check if plugin is installed
  installed_version=$(echo "$INSTALLED_PLUGINS_JSON" | jq -r --arg name "$plugin_name" '.[] | select(.id | startswith($name + "@")) | .version' 2>/dev/null || echo "")

  if [ -z "$installed_version" ]; then
    # Plugin not installed
    log INFO "Installing new plugin: $plugin_name@$marketplace_version"
    if [ "$CHECK_ONLY" = false ]; then
      if ! claude plugin install "${plugin_name}@baleen-plugins" 2>/dev/null; then
        log ERROR "Failed to install $plugin_name"
      else
        log INFO "Successfully installed $plugin_name@$marketplace_version"
      fi
    fi
  elif version_lt "$installed_version" "$marketplace_version"; then
    # Update available
    log INFO "Updating plugin: $plugin_name ($installed_version → $marketplace_version)"
    if [ "$CHECK_ONLY" = false ]; then
      if ! claude plugin update "${plugin_name}@baleen-plugins" 2>/dev/null; then
        log ERROR "Failed to update $plugin_name"
      else
        log INFO "Successfully updated $plugin_name to $marketplace_version"
      fi
    fi
  fi
done <<< "$MARKETPLACE_PLUGINS"

# Update timestamp
if [ "$CHECK_ONLY" = false ]; then
  update_timestamp
fi

exit 0
