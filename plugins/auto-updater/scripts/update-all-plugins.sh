#!/usr/bin/env bash
#
# update-all-plugins.sh
# Update all plugins from marketplace using claude plugin install
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Marketplace URL
MARKETPLACE_URL="https://raw.githubusercontent.com/baleen37/claude-plugins/main/.claude-plugin/marketplace.json"

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
    log_info "Downloading marketplace.json from $MARKETPLACE_URL"
    if ! curl -fsSL "$MARKETPLACE_URL" -o "$TMP_DIR/marketplace.json"; then
        log_error "Failed to download marketplace.json"
        return 1
    fi
    log_success "Downloaded marketplace.json"
}

# Get list of plugins from marketplace (simple grep/sed approach)
get_marketplace_plugins() {
    # Extract plugin names from JSON using grep and sed
    # Matches: "name": "plugin-name"
    grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$TMP_DIR/marketplace.json" 2>/dev/null | \
        sed 's/.*"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || echo ""
}

# Parse all plugins at once into a simpler format
parse_plugins_to_cache() {
    local json_file="$TMP_DIR/marketplace.json"
    local cache_file="$TMP_DIR/plugins.cache"

    # Get marketplace name from the JSON (look for the top-level name)
    local marketplace
    marketplace=$(grep -E '^\s*"name"' "$json_file" | head -n 1 | sed 's/.*"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

    if [[ -z "$marketplace" ]]; then
        marketplace="baleen-plugins"
    fi

    # Create a simple "name|marketplace" format cache
    : > "$cache_file"

    # Use sed to extract plugin names only within "plugins": [ ... ] section
    # Strategy: Extract content between plugins array brackets, then find plugin names
    sed -n '
    # Start capturing when we find "plugins": [
    /"plugins"[[:space:]]*:[[:space:]]*\[/ {
        # Start loop
        :loop
        # Read next line
        n
        # If we found the closing bracket, we are done
        /^\s*\]/ q
        # Look for "name": "value" pattern
        /"name"[[:space:]]*:[[:space:]]*"[^"]*"/ {
            # Extract the plugin name
            s/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1|'"$marketplace"'/
            p
        }
        # Continue loop
        b loop
    }
    ' "$json_file" > "$cache_file"
}

# Get marketplace from cache
get_marketplace_from_cache() {
    local plugin_name="$1"
    local cache_file="$TMP_DIR/plugins.cache"

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
    echo "  Update All Plugins from Marketplace"
    echo "=========================================="
    echo ""

    # Download marketplace.json
    if ! download_marketplace; then
        log_error "Cannot proceed without marketplace data"
        exit 1
    fi

    # Parse plugins into cache file
    log_info "Parsing marketplace data"
    if ! parse_plugins_to_cache; then
        log_error "Failed to parse marketplace data"
        exit 1
    fi

    # Get list of plugins from cache
    marketplace_plugins=$(cut -d'|' -f1 "$TMP_DIR/plugins.cache")

    if [[ -z "$marketplace_plugins" ]]; then
        log_error "No plugins found in marketplace.json"
        exit 1
    fi

    # Count plugins
    plugin_count=$(echo "$marketplace_plugins" | wc -l | tr -d ' ')
    log_info "Found $plugin_count plugins in marketplace"
    echo ""

    # Track results
    success_count=0
    failed_count=0
    failed_plugins=()

    # Install/update each plugin
    while IFS= read -r plugin_name; do
        [[ -z "$plugin_name" ]] && continue

        marketplace=$(get_marketplace_from_cache "$plugin_name")

        if [[ -z "$marketplace" ]]; then
            log_warning "No marketplace found for $plugin_name, skipping"
            continue
        fi

        if install_plugin "$plugin_name" "$marketplace"; then
            ((success_count++)) || true
        else
            ((failed_count++)) || true
            failed_plugins+=("$plugin_name")
        fi
    done <<< "$marketplace_plugins"

    echo ""
    echo "=========================================="
    echo "  Summary"
    echo "=========================================="
    echo ""

    # Update timestamp only if at least one plugin succeeded
    if [[ $success_count -gt 0 ]]; then
        CONFIG_DIR="${HOME}/.claude/auto-updater"
        TIMESTAMP_FILE="${CONFIG_DIR}/last-check"
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
