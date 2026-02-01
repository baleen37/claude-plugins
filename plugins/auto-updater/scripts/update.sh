#!/usr/bin/env bash
#
# update.sh - Main update script for auto-updater plugin
# Downloads marketplace.json and updates plugins if needed
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
NC='\033[0m' # No Color

# Log functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
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

# Main update function
main() {
    local config
    local marketplaces
    local installed_plugins
    local updated_count=0

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
        log_info "Downloading marketplace.json from ${marketplace_name}..."

        remote_mp=$(download_marketplace_json "${org}" "${repo}")
        if [[ -z "${remote_mp}" ]]; then
            log_warning "Failed to download marketplace.json from ${marketplace_name}, skipping..."
            continue
        fi

        # Get plugins to check for this marketplace (by name)
        plugins_to_check=$(get_plugins_for_marketplace "${config}" "${name}")
        marketplace_plugins=$(echo "${remote_mp}" | jq -r '.plugins // []')

        # If plugins field is specified, filter by those plugins
        if [[ "${plugins_to_check}" == "[]" ]]; then
            log_info "No plugins specified for ${marketplace_name}, skipping..."
            continue
        fi

        if [[ "${plugins_to_check}" != "" ]]; then
            log_info "Checking specific plugins for ${marketplace_name}..."

            # Create a filtered list of plugins
            while IFS= read -r plugin_name; do
                local plugin_data
                local remote_version
                local local_version

                # Find plugin in marketplace
                plugin_data=$(echo "${marketplace_plugins}" | jq -r --arg name "${plugin_name}" '.[] | select(.name == $name)')

                if [[ -z "${plugin_data}" ]]; then
                    log_warning "Plugin ${plugin_name} not found in ${marketplace_name}"
                    continue
                fi

                # Get versions
                remote_version=$(echo "${plugin_data}" | jq -r '.version // "unknown"')
                local_version=$(echo "${installed_plugins}" | jq -r --arg name "${plugin_name}" '.[] | select(.name == $name) | .version // "unknown"')

                if [[ "${local_version}" == "unknown" ]]; then
                    log_info "Plugin ${plugin_name} is not installed"
                    continue
                fi

                # Compare versions
                if version_lt "${local_version}" "${remote_version}"; then
                    log_info "Updating ${plugin_name}: ${local_version} -> ${remote_version}"

                    if claude plugin install "${org}/${repo}/${plugin_name}"; then
                        log_success "Updated ${plugin_name} to ${remote_version}"
                        ((updated_count++)) || true
                    else
                        log_error "Failed to update ${plugin_name}"
                    fi
                else
                    log_info "${plugin_name} is up to date (${local_version})"
                fi
            done < <(echo "${plugins_to_check}" | jq -r '.[]')
        else
            # No specific plugins, check all installed plugins from this marketplace
            log_info "Checking all plugins from ${marketplace_name}..."

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
                    log_info "Updating ${plugin_name}: ${local_version} -> ${remote_version}"

                    if claude plugin install "${org}/${repo}/${plugin_name}"; then
                        log_success "Updated ${plugin_name} to ${remote_version}"
                        ((updated_count++)) || true
                    else
                        log_error "Failed to update ${plugin_name}"
                    fi
                fi
            done < <(echo "${installed_plugins}" | jq -r '.[].name')
        fi
    done < <(echo "${marketplaces}" | jq -c '.[]')

    if [[ ${updated_count} -eq 0 ]]; then
        log_success "All plugins are up to date"
    else
        log_success "Updated ${updated_count} plugin(s)"
    fi
}

main "$@"
