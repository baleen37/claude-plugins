#!/usr/bin/env bash
#
# check.sh - Check for plugin updates without installing
# Displays plugins that can be updated with current vs marketplace versions
#

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source libraries
# shellcheck source=plugins/auto-updater/scripts/lib/config.sh
source "${SCRIPT_DIR}/lib/config.sh"
# shellcheck source=plugins/auto-updater/scripts/lib/version-compare.sh
source "${SCRIPT_DIR}/lib/version-compare.sh"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Config directory
CONFIG_DIR="${HOME}/.claude/auto-updater"

# Silent mode (suppress output)
SILENT_MODE=false

# Update last-check timestamp
update_last_check_timestamp() {
    mkdir -p "${CONFIG_DIR}"
    date +%s > "${CONFIG_DIR}/last-check"
}

# Log functions
log_info() {
    if [ "$SILENT_MODE" = false ]; then
        echo -e "${BLUE}[INFO]${NC} $*"
    fi
}

log_warning() {
    if [ "$SILENT_MODE" = false ]; then
        echo -e "${YELLOW}[WARNING]${NC} $*"
    fi
}

log_error() {
    if [ "$SILENT_MODE" = false ]; then
        echo -e "${RED}[ERROR]${NC} $*" >&2
    fi
}

# Download marketplace.json from GitHub
# Args: org, repo
download_marketplace_json() {
    local org="$1"
    local repo="$2"
    local url="https://raw.githubusercontent.com/${org}/${repo}/main/.claude-plugin/marketplace.json"
    local tmp_file

    tmp_file=$(mktemp)

    if curl -fsSL "${url}" -o "${tmp_file}"; then
        cat "${tmp_file}"
        rm -f "${tmp_file}"
        return 0
    else
        rm -f "${tmp_file}"
        return 1
    fi
}

# Get installed plugins using claude CLI
get_installed_plugins() {
    if ! claude plugin list --json 2>/dev/null; then
        log_error "Failed to get installed plugins"
        return 1
    fi
}

# Display update available with color coding
show_update_available() {
    if [ "$SILENT_MODE" = true ]; then
        return
    fi
    local plugin_name="$1"
    local local_version="$2"
    local remote_version="$3"

    echo -e "  ${BOLD}${plugin_name}${NC}: ${RED}${local_version}${NC} → ${GREEN}${remote_version}${NC}"
}

# Display plugin up to date
show_up_to_date() {
    if [ "$SILENT_MODE" = true ]; then
        return
    fi
    local plugin_name="$1"
    local version="$2"

    echo -e "  ${plugin_name}: ${GREEN}${version}${NC} (up to date)"
}

# Helper function for conditional output
print_output() {
    if [ "$SILENT_MODE" = false ]; then
        echo "$@"
    fi
}

# Main check function
main() {
    local config
    local marketplaces
    local installed_plugins
    local updateable_count=0
    local up_to_date_count=0

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --silent)
                SILENT_MODE=true
                shift
                ;;
            --check-only)
                # Check-only mode - don't update timestamp
                shift
                ;;
            *)
                shift
                ;;
        esac
    done

    # Load config
    config=$(load_config)
    if [[ -z "${config}" ]]; then
        log_error "Failed to load config"
        exit 1
    fi

    # Get marketplaces array
    marketplaces=$(echo "${config}" | jq -r '.marketplaces // []')

    # Check if there are any marketplaces configured
    if [[ "${marketplaces}" == "[]" ]]; then
        log_warning "No marketplaces configured in config.json"
        exit 0
    fi

    # Get installed plugins
    log_info "Checking installed plugins..."
    installed_plugins=$(get_installed_plugins)
    if [[ -z "${installed_plugins}" ]]; then
        log_warning "No plugins installed or failed to get plugin list"
        exit 0
    fi

    print_output ""

    # Iterate through marketplaces
    while IFS= read -r mp; do
        local name
        local marketplace_name
        local org_repo
        local org
        local repo
        local remote_mp
        local plugins_to_check
        local marketplace_plugins
        local marketplace_updateable=0

        name=$(echo "${mp}" | jq -r '.name // empty')

        if [[ -z "${name}" ]]; then
            log_warning "Skipping marketplace with missing name"
            continue
        fi

        # Get org/repo from marketplace name
        org_repo=$(get_org_repo_for_marketplace "${name}")

        if [[ -z "${org_repo}" ]]; then
            log_warning "Unknown marketplace '${name}', skipping..."
            continue
        fi

        org=$(echo "${org_repo}" | cut -d'/' -f1)
        repo=$(echo "${org_repo}" | cut -d'/' -f2)
        marketplace_name="${org_repo}"

        # Download marketplace.json
        log_info "Checking marketplace.json from ${marketplace_name}..."

        remote_mp=$(download_marketplace_json "${org}" "${repo}")
        if [[ -z "${remote_mp}" ]]; then
            log_warning "Failed to download marketplace.json from ${marketplace_name}, skipping..."
            continue
        fi

        # Get plugins to check for this marketplace (by name)
        plugins_to_check=$(get_plugins_for_marketplace "${config}" "${name}")
        marketplace_plugins=$(echo "${remote_mp}" | jq -r '.plugins // []')

        print_output -e "${BOLD}${marketplace_name}${NC}:"

        # If plugins field is specified, filter by those plugins
        if [[ "${plugins_to_check}" == "[]" ]]; then
            log_info "  No plugins specified for ${marketplace_name}, skipping..."
            continue
        fi

        if [[ "${plugins_to_check}" != "" ]]; then
            while IFS= read -r plugin_name; do
                local plugin_data
                local remote_version
                local local_version

                # Find plugin in marketplace
                plugin_data=$(echo "${marketplace_plugins}" | jq -r --arg name "${plugin_name}" '.[] | select(.name == $name)')

                if [[ -z "${plugin_data}" ]]; then
                    log_warning "  Plugin ${plugin_name} not found in ${marketplace_name}"
                    continue
                fi

                # Get versions
                remote_version=$(echo "${plugin_data}" | jq -r '.version // "unknown"')
                local_version=$(echo "${installed_plugins}" | jq -r --arg name "${plugin_name}" '.[] | select(.name == $name) | .version // "unknown"')

                if [[ "${local_version}" == "unknown" ]]; then
                    log_warning "  Plugin ${plugin_name} is not installed"
                    continue
                fi

                # Compare versions
                if version_lt "${local_version}" "${remote_version}"; then
                    show_update_available "${plugin_name}" "${local_version}" "${remote_version}"
                    ((updateable_count++)) || true
                    ((marketplace_updateable++)) || true
                else
                    show_up_to_date "${plugin_name}" "${local_version}"
                    ((up_to_date_count++)) || true
                fi
            done < <(echo "${plugins_to_check}" | jq -r '.[]')
        else
            # No specific plugins, check all installed plugins from this marketplace
            while IFS= read -r plugin_name; do
                local plugin_data
                local remote_version
                local local_version

                # Find plugin in marketplace
                plugin_data=$(echo "${marketplace_plugins}" | jq -r --arg name "${plugin_name}" '.[] | select(.name == $name)')

                if [[ -z "${plugin_data}" ]]; then
                    continue
                fi

                # Get versions
                remote_version=$(echo "${plugin_data}" | jq -r '.version // "unknown"')
                local_version=$(echo "${installed_plugins}" | jq -r --arg name "${plugin_name}" '.[] | select(.name == $name) | .version // "unknown"')

                if [[ "${local_version}" == "unknown" ]]; then
                    continue
                fi

                # Compare versions
                if version_lt "${local_version}" "${remote_version}"; then
                    show_update_available "${plugin_name}" "${local_version}" "${remote_version}"
                    ((updateable_count++)) || true
                    ((marketplace_updateable++)) || true
                else
                    show_up_to_date "${plugin_name}" "${local_version}"
                    ((up_to_date_count++)) || true
                fi
            done < <(echo "${installed_plugins}" | jq -r '.[].name')
        fi

        # Summary for this marketplace
        if [[ ${marketplace_updateable} -eq 0 ]]; then
            print_output -e "  ${GREEN}✓${NC} All plugins up to date"
        else
            print_output -e "  ${YELLOW}${marketplace_updateable} update(s) available${NC}"
        fi

        print_output ""
    done < <(echo "${marketplaces}" | jq -c '.[]')

    # Final summary
    print_output -e "${BOLD}Summary:${NC}"
    print_output -e "  ${GREEN}${up_to_date_count} up to date${NC}"
    print_output -e "  ${YELLOW}${updateable_count} update(s) available${NC}"

    if [[ ${updateable_count} -gt 0 ]]; then
        print_output ""
        print_output -e "Run ${BOLD}update-all-plugins${NC} to install updates"
    fi

    # Update last-check timestamp
    update_last_check_timestamp
}

main "$@"
