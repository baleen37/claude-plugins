#!/usr/bin/env bash
#
# update-all-plugins.sh
# Update all plugins from configured marketplaces
#

set -euo pipefail

# Load libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/config-loader.sh
source "${SCRIPT_DIR}/lib/config-loader.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONFIG_DIR="${HOME}/.claude/auto-updater"
CONFIG_FILE="${CONFIG_DIR}/config.json"
TIMESTAMP_FILE="${CONFIG_DIR}/last-check"

# Temporary directory
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Download marketplace.json
download_marketplace() {
    local marketplace_url="$1"
    local output_file="$2"

    if ! curl -fsSL "$marketplace_url" -o "$output_file"; then
        return 1
    fi
    return 0
}

# Parse plugins from marketplace JSON and filter by config
parse_plugins_to_cache() {
    local marketplace_json="$1"
    local cache_file="$2"

    local marketplace_name plugins_config
    marketplace_name=$(get_marketplace_name "$marketplace_json")
    plugins_config=$(echo "$marketplace_json" | jq -r '.plugins // "all"')

    # Create cache file
    : > "$cache_file"

    # If include is omitted or "all", extract all plugin names
    if [ "$plugins_config" = "all" ] || [ "$plugins_config" = "null" ]; then
        # Use jq to extract plugin names with marketplace suffix
        jq -r '.plugins[].name | . + "|'"$marketplace_name"'"' "$TMP_DIR/marketplace-${marketplace_name}.json" 2>/dev/null > "$cache_file" || true
    else
        # Extract only specified plugins
        for plugin_name in $(echo "$plugins_config" | jq -r '.[]'); do
            echo "${plugin_name}|${marketplace_name}" >> "$cache_file"
        done
    fi
}

# Get marketplace from cache
get_marketplace_from_cache() {
    local plugin_name="$1"
    local cache_file="$2"

    local result
    result=$(grep "^${plugin_name}|" "$cache_file" 2>/dev/null | cut -d'|' -f2 | head -n 1)
    echo "${result:-}"
}

# Install/update a plugin
install_plugin() {
    local plugin_name="$1"
    local marketplace="$2"

    log_info "Installing/updating $plugin_name from $marketplace"

    if claude plugin install "${plugin_name}@${marketplace}" --scope user >/dev/null 2>&1; then
        log_success "$plugin_name installed/updated successfully"
        return 0
    else
        log_warning "Failed to install/update $plugin_name"
        return 1
    fi
}

# Main execution
main() {
    echo "=========================================="
    echo "  Update All Plugins from Marketplaces"
    echo "=========================================="
    echo ""

    # Load configuration
    load_config "$CONFIG_FILE"

    # Track results across all marketplaces
    success_count=0
    failed_count=0
    failed_plugins=()

    # Process each marketplace
    while IFS= read -r marketplace; do
        [ -z "$marketplace" ] && continue

        marketplace_name=$(get_marketplace_name "$marketplace")
        marketplace_url=$(get_marketplace_url "$marketplace")

        if [ -z "$marketplace_url" ]; then
            log_warning "No URL for marketplace: $marketplace_name, skipping"
            continue
        fi

        log_info "Processing marketplace: $marketplace_name"

        # Download marketplace.json
        local marketplace_file="$TMP_DIR/marketplace-${marketplace_name}.json"
        if ! download_marketplace "$marketplace_url" "$marketplace_file"; then
            log_warning "Failed to download marketplace.json for $marketplace_name"
            continue
        fi

        # Parse plugins into cache file
        local cache_file="$TMP_DIR/plugins-${marketplace_name}.cache"
        parse_plugins_to_cache "$marketplace" "$cache_file"

        # Get list of plugins from cache
        marketplace_plugins=$(cut -d'|' -f1 "$cache_file")

        if [ -z "$marketplace_plugins" ]; then
            log_warning "No plugins found in $marketplace_name"
            continue
        fi

        # Count plugins
        plugin_count=$(echo "$marketplace_plugins" | wc -l | tr -d ' ')
        log_info "Found $plugin_count plugins in $marketplace_name"

        # Install/update each plugin
        while IFS= read -r plugin_name; do
            [ -z "$plugin_name" ] && continue

            marketplace=$(get_marketplace_from_cache "$plugin_name" "$cache_file")

            if [ -z "$marketplace" ]; then
                log_warning "No marketplace found for $plugin_name, skipping"
                continue
            fi

            if install_plugin "$plugin_name" "$marketplace"; then
                ((success_count++)) || true
            else
                ((failed_count++)) || true
                failed_plugins+=("$plugin_name@$marketplace")
            fi
        done <<< "$marketplace_plugins"
    done <<< "$(get_marketplaces "$CONFIG_FILE")"

    echo ""
    echo "=========================================="
    echo "  Summary"
    echo "=========================================="
    echo ""

    # Update timestamp only if at least one plugin succeeded
    if [[ $success_count -gt 0 ]]; then
        mkdir -p "$CONFIG_DIR"
        date +%s > "$TIMESTAMP_FILE"
        log_info "Updated last-check timestamp"
    else
        log_warning "Skipping timestamp update (no successful updates)"
    fi

    log_success "Successfully installed/updated: $success_count plugins"

    if [[ $failed_count -gt 0 ]]; then
        log_warning "Failed to install/update: $failed_count plugins"
        echo ""
        log_info "Failed plugins:"
        for plugin in "${failed_plugins[@]}"; do
            echo "  - $plugin"
        done
    fi

    echo ""
    log_success "Done!"
}

main "$@"
