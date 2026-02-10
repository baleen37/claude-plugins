#!/usr/bin/env bash
# Databricks Quick Code Execution Tool
# Run Python code immediately on a Databricks cluster
#
# Usage:
#   ./run-simple.sh '[code]'         - Execute Python code
#   ./run-simple.sh -h               - Show help
#
# Environment:
#   DATABRICKS_PROFILE   - CLI profile (default: DEFAULT)
#   CLUSTER_ID          - Cluster ID (default: auto-detect)
#   WAIT_TIMEOUT        - Job wait timeout in seconds (default: 120)

set -euo pipefail

# Configuration
readonly PROFILE="${DATABRICKS_PROFILE:-DEFAULT}"
readonly WAIT_TIMEOUT="${WAIT_TIMEOUT:-120}"

# Colors for output
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly RED='\033[0;31m'
readonly NC='\033[0m' # No Color

# Output functions
log() {
    echo -e "${GREEN}[INFO]${NC} $*" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

# Get current user email
get_user() {
    databricks --profile "$PROFILE" current-user me --output json 2>/dev/null | \
        jq -r '.userName'
}

# Get first running cluster ID
get_cluster() {
    if [ -n "${CLUSTER_ID:-}" ]; then
        echo "$CLUSTER_ID"
        return
    fi

    databricks --profile "$PROFILE" clusters list --output json 2>/dev/null | \
        jq -r '.[] | select(.state == "RUNNING") | .cluster_id' | head -1
}

# Validate cluster is accessible
validate_cluster() {
    local cluster_id="$1"

    databricks --profile "$PROFILE" clusters get "$cluster_id" --output json >/dev/null 2>&1 || {
        error "Cluster $cluster_id not found or not accessible"
        return 1
    }

    local state
    state=$(databricks --profile "$PROFILE" clusters get "$cluster_id" --output json | \
        jq -r '.state')

    if [ "$state" != "RUNNING" ]; then
        error "Cluster $cluster_id is not running (state: $state)"
        return 1
    fi

    return 0
}

# Execute code on cluster
run_code() {
    local code="$1"
    local user
    local cluster
    local temp_path
    local run_id
    local result_state
    local temp_file

    # Get user and cluster
    user=$(get_user)
    if [ -z "$user" ] || [ "$user" = "null" ]; then
        error "Failed to get current user. Check profile: $PROFILE"
        return 1
    fi

    cluster=$(get_cluster)
    if [ -z "$cluster" ]; then
        error "No running cluster found. Please start a cluster or set CLUSTER_ID"
        error ""
        error "Available clusters:"
        databricks --profile "$PROFILE" clusters list --output json 2>/dev/null | \
            jq -r '.[] | "  \(.cluster_name) (\(.cluster_id)) - \(.state)"' >&2 || true
        return 1
    fi

    # Validate cluster
    log "Using cluster: $cluster"
    validate_cluster "$cluster" || return 1

    # Create temporary notebook path
    temp_path="/Users/$user/.databricks-cli-temp/run_$(date +%s)"
    temp_file="/tmp/nb_$(date +%s).py"

    # Create temporary notebook file
    mkdir -p "/tmp/nb_$(date +%s)" 2>/dev/null || true
    cat > "$temp_file" << EOF
# Databricks notebook source
# Command 1
$code
EOF

    # Create workspace directory
    databricks --profile "$PROFILE" workspace mkdirs "/Users/$user/.databricks-cli-temp" >/dev/null 2>&1 || true

    # Import notebook
    log "Importing notebook to: $temp_path"
    databricks --profile "$PROFILE" workspace import \
        "$temp_file" \
        "$temp_path" \
        --language PYTHON \
        --overwrite >/dev/null 2>&1

    # Submit job
    log "Submitting job for execution..."
    run_id=$(databricks --profile "$PROFILE" jobs submit --json "{
        \"run_name\": \"quick-run-$(date +%s)\",
        \"tasks\": [{
            \"task_key\": \"run\",
            \"notebook_task\": {
                \"notebook_path\": \"$temp_path\"
            },
            \"existing_cluster_id\": \"$cluster\"
        }]
    }" --output json | jq -r '.run_id')

    if [ -z "$run_id" ] || [ "$run_id" = "null" ]; then
        error "Failed to submit job"
        databricks --profile "$PROFILE" workspace delete "$temp_path" >/dev/null 2>&1 || true
        rm -f "$temp_file"
        return 1
    fi

    log "Job submitted: run_id=$run_id"
    log "Waiting for completion (timeout: ${WAIT_TIMEOUT}s)..."

    # Wait for completion with timeout
    local elapsed=0
    local sleep_time=5

    while [ $elapsed -lt $WAIT_TIMEOUT ]; do
        sleep "$sleep_time"
        elapsed=$((elapsed + sleep_time))

        local state_info
        state_info=$(databricks --profile "$PROFILE" jobs get-run "$run_id" --output json 2>/dev/null || echo "{}")
        result_state=$(echo "$state_info" | jq -r '.tasks[0].state.result_state // "RUNNING"')
        local life_cycle_state
        life_cycle_state=$(echo "$state_info" | jq -r '.tasks[0].state.life_cycle_state // "RUNNING"')

        case "$life_cycle_state" in
            TERMINATED)
                break
                ;;
            INTERNAL_ERROR|SKIPPED|FAILED)
                warn "Job state: $life_cycle_state"
                break
                ;;
            PENDING|RUNNING|BLOCKED)
                local progress=$((elapsed * 100 / WAIT_TIMEOUT))
                echo -ne "\r${GREEN}[INFO]${NC} Waiting... ${progress}% ($life_cycle_state)" >&2
                ;;
            *)
                warn "Unknown state: $life_cycle_state"
                break
                ;;
        esac
    done

    echo "" >&2

    # Get final result
    local final_state
    final_state=$(databricks --profile "$PROFILE" jobs get-run "$run_id" --output json | \
        jq -r '.tasks[0].state.life_cycle_state')

    if [ "$final_state" != "TERMINATED" ]; then
        error "Job did not complete successfully (state: $final_state)"
    else
        result_state=$(databricks --profile "$PROFILE" jobs get-run "$run_id" --output json | \
            jq -r '.tasks[0].state.result_state')

        case "$result_state" in
            SUCCESS)
                log "Job completed successfully"
                ;;
            FAILED|TIMEDOUT|CANCELED)
                error "Job $result_state"
                ;;
            *)
                log "Job result: $result_state"
                ;;
        esac
    fi

    # Cleanup
    databricks --profile "$PROFILE" workspace delete "$temp_path" >/dev/null 2>&1 || true
    rm -f "$temp_file"

    return 0
}

# Main function
main() {
    local code="$1"

    # Show what's being run
    log "Profile: $PROFILE"
    log "Code to execute:"
    local indented_code
    indented_code="${code//$'\n'/$'\n'    > }"
    echo "    > $indented_code" >&2
    echo "" >&2

    # Execute
    run_code "$code"
}

# Help message
show_help() {
    cat << EOF
Databricks Quick Code Execution Tool

Run Python code immediately on a Databricks cluster.

Usage:
  $0 '[python-code]'       Execute Python code
  $0 -h, --help            Show this help

Examples:
  $0 'print("Hello World")'
  $0 'df = spark.range(10); df.show()'
  $0 'spark.sql("SELECT 1").show()'

Environment Variables:
  DATABRICKS_PROFILE       CLI profile to use (default: DEFAULT)
  CLUSTER_ID              Specific cluster ID (default: auto-detect running)
  WAIT_TIMEOUT            Job wait timeout in seconds (default: 120)

Notes:
  - Code is executed as a temporary notebook
  - Requires at least one running cluster
  - Uses the first available running cluster unless CLUSTER_ID is set
  - Temporary notebook is cleaned up after execution
EOF
}

# Parse arguments
case "${1:-}" in
    -h|--help|help)
        show_help
        exit 0
        ;;
    "")
        error "No code provided"
        echo "" >&2
        show_help
        exit 1
        ;;
    *)
        main "$1"
        ;;
esac
