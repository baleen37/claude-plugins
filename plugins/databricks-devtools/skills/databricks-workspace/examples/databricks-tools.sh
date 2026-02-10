#!/usr/bin/env bash
# Databricks Workspace Tools
# Usage: ./databricks-tools.sh [command] [args]
#
# Commands:
#   run "[code]"          - Execute Python code immediately
#   upload [file] [path]  - Upload file to workspace
#   list [path]           - List workspace items
#   repos                - List Git repos
#
# Environment:
#   DATABRICKS_PROFILE   - CLI profile (default: alpha)
#   CLUSTER_ID           - Cluster ID (default: auto-detect)

set -euo pipefail

PROFILE="${DATABRICKS_PROFILE:-alpha}"
USER=$(databricks --profile "$PROFILE" current-user me --output json | jq -r '.userName')

get_cluster() {
    if [ -n "${CLUSTER_ID:-}" ]; then
        echo "$CLUSTER_ID"
    else
        databricks --profile "$PROFILE" clusters list --output json 2>/dev/null | \
            jq -r '.[] | select(.state == "RUNNING") | .cluster_id' | head -1
    fi
}

# Run code immediately
run() {
    local code="${1:-print('Hello from Databricks')}"
    local cluster
    cluster=$(get_cluster)
    local temp="/Users/$USER/.temp/run_$(date +%s)"

    databricks --profile "$PROFILE" workspace mkdirs "/Users/$USER/.temp" >/dev/null 2>&1 || true
    echo "# Databricks notebook source" > /tmp/nb.py
    echo "$code" >> /tmp/nb.py

    databricks --profile "$PROFILE" workspace import "$temp" --file /tmp/nb.py --language PYTHON --overwrite >/dev/null
    databricks --profile "$PROFILE" jobs submit --json "{\"run_name\":\"run\",\"tasks\":[{\"task_key\":\"t\",\"notebook_task\":{\"notebook_path\":\"$temp\"},\"existing_cluster_id\":\"$cluster\"}]}" -o json | \
        jq -c '{run_id,result:.tasks[0].state.result_state,duration:.tasks[0].execution_duration}'

    databricks --profile "$PROFILE" workspace delete "$temp" >/dev/null 2>&1
    rm /tmp/nb.py
}

# Upload file to workspace
upload() {
    local file="$1"
    local path="${2:-/Users/$USER/$(basename "$file" .py)}"
    databricks --profile "$PROFILE" workspace import "$path" --file "$file" --language PYTHON
    echo "Uploaded: $path"
}

# List workspace
list() {
    local path="${1:-}"
    shift || true
    databricks --profile "$PROFILE" workspace list "${path:-/}" "$@"
}

# List repos
repos() {
    databricks --profile "$PROFILE" repos list "$@"
}

# Main
COMMAND="${1:-run}"
shift || true

case "$COMMAND" in
    run) run "$@" ;;
    upload) upload "$@" ;;
    list) list "$@" ;;
    repos) repos "$@" ;;
    *) echo "Usage: $0 [run|upload|list|repos] [args...]"; exit 1 ;;
esac
