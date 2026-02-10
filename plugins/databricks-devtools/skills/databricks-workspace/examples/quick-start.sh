#!/usr/bin/env bash
# Databricks Workspace Quick Start Demo
# Comprehensive workspace operations demonstration
#
# Usage:
#   ./quick-start.sh [profile]
#
# Environment:
#   DATABRICKS_PROFILE - CLI profile (default: DEFAULT)
#   CLUSTER_ID        - Cluster ID (default: auto-detect)

set -euo pipefail

# Configuration
PROFILE="${DATABRICKS_PROFILE:-DEFAULT}"
DEMO_DIR="/tmp/databricks-demo-$$"

# Colors for output
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[DEMO]${NC} $*"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

# Get current user
get_user() {
    databricks --profile "$PROFILE" current-user me --output json | jq -r '.userName'
}

# Get first running cluster
get_cluster() {
    if [ -n "${CLUSTER_ID:-}" ]; then
        echo "$CLUSTER_ID"
        return
    fi

    databricks --profile "$PROFILE" clusters list --output json 2>/dev/null | \
        jq -r '.[] | select(.state == "RUNNING") | .cluster_id' | head -1
}

# Demo 1: List workspace items
demo_list() {
    log "Demo 1: Listing workspace items"
    log "Root directory contents:"
    databricks --profile "$PROFILE" workspace list /
    echo

    USER=$(get_user)
    log "User directory contents:"
    databricks --profile "$PROFILE" workspace list "/Users/$USER"
    echo
}

# Demo 2: Create directories
demo_mkdirs() {
    log "Demo 2: Creating workspace directories"

    USER=$(get_user)
    local timestamp
    timestamp=$(date +%s)
    local demo_base="/Users/$USER/demo-$timestamp"

    databricks --profile "$PROFILE" workspace mkdirs "$demo_base"
    databricks --profile "$PROFILE" workspace mkdirs "$demo_base/notebooks"
    databricks --profile "$PROFILE" workspace mkdirs "$demo_base/data"

    success "Created directory structure: $demo_base"
    echo "$demo_base" > "$DEMO_DIR/base_path.txt"
    echo
}

# Demo 3: Upload and import code
demo_import() {
    log "Demo 3: Importing notebooks to workspace"

    USER=$(get_user)
    local demo_base
    demo_base=$(cat "$DEMO_DIR/base_path.txt")

    # Create sample notebook
    cat > "$DEMO_DIR/sample.py" << 'EOF'
# Databricks notebook source
# Command 1
print("Hello from Databricks!")

# Command 2
df = spark.range(10)
display(df)

# Command 3
count = df.count()
print(f"Total records: {count}")
EOF

    # Import notebook
    databricks --profile "$PROFILE" workspace import \
        "$DEMO_DIR/sample.py" \
        "$demo_base/notebooks/SampleNotebook"

    success "Imported sample notebook to: $demo_base/notebooks/SampleNotebook"
    echo
}

# Demo 4: Quick code execution
demo_run() {
    log "Demo 4: Quick code execution"

    USER=$(get_user)
    local demo_base
    demo_base=$(cat "$DEMO_DIR/base_path.txt")
    local cluster
    cluster=$(get_cluster)

    if [ -z "$cluster" ]; then
        log "No running cluster found, skipping execution demo"
        echo
        return
    fi

    # Create temporary notebook for execution
    cat > "$DEMO_DIR/temp.py" << 'EOF'
# Databricks notebook source
# Command 1
result = spark.range(5).count()
print(f"Quick execution result: {result}")
EOF

    local temp_path="$demo_base/.temp-exec"
    databricks --profile "$PROFILE" workspace import \
        "$DEMO_DIR/temp.py" \
        "$temp_path" --overwrite >/dev/null

    log "Submitting job to cluster: $cluster"

    databricks --profile "$PROFILE" jobs submit --json "{
        \"run_name\": \"quick-start-demo\",
        \"tasks\": [{
            \"task_key\": \"demo\",
            \"notebook_task\": {
                \"notebook_path\": \"$temp_path\"
            },
            \"existing_cluster_id\": \"$cluster\"
        }]
    }" --output json | jq -c '{run_id: .run_id, state: .tasks[0].state.life_cycle_state}'

    databricks --profile "$PROFILE" workspace delete "$temp_path" >/dev/null 2>&1 || true
    success "Submitted job for execution"
    echo
}

# Demo 5: Git repos operations
demo_repos() {
    log "Demo 5: Listing Git repositories"
    databricks --profile "$PROFILE" repos list --output json | \
        jq -r '.[] | "\(.path | split("/") | .[-1]) - \(.url)' 2>/dev/null || \
        log "No repos found or repos API not available"
    echo
}

# Demo 6: Export workspace items
demo_export() {
    log "Demo 6: Exporting workspace items"

    USER=$(get_user)
    local demo_base
    demo_base=$(cat "$DEMO_DIR/base_path.txt")

    # Export single notebook
    databricks --profile "$PROFILE" workspace export \
        "$demo_base/notebooks/SampleNotebook" \
        "$DEMO_DIR/exported_sample.py"

    success "Exported notebook to: $DEMO_DIR/exported_sample.py"

    # Export directory
    databricks --profile "$PROFILE" workspace export-dir \
        "$demo_base/notebooks" \
        "$DEMO_DIR/exported_dir"

    success "Exported directory to: $DEMO_DIR/exported_dir"
    echo
}

# Cleanup
demo_cleanup() {
    log "Cleaning up demo resources"

    USER=$(get_user)
    local demo_base
    demo_base=$(cat "$DEMO_DIR/base_path.txt" 2>/dev/null || true)

    if [ -n "$demo_base" ]; then
        databricks --profile "$PROFILE" workspace delete "$demo_base" --recursive >/dev/null 2>&1 || true
        success "Deleted workspace demo directory"
    fi

    rm -rf "$DEMO_DIR"
    success "Removed temporary files"
}

# Main execution
main() {
    log "Starting Databricks Workspace Demo (profile: $PROFILE)"
    log "Demo directory: $DEMO_DIR"
    echo

    mkdir -p "$DEMO_DIR"

    # Set trap for cleanup
    trap demo_cleanup EXIT INT TERM

    # Run demos
    demo_list
    demo_mkdirs
    demo_import
    demo_run
    demo_repos
    demo_export

    success "Demo completed successfully!"
    echo

    log "Files retained in $DEMO_DIR for inspection"
    log "Cleanup will run on exit"
}

# Help message
show_help() {
    cat << EOF
Databricks Workspace Quick Start Demo

Usage:
  $0 [profile]           Run demo with specified profile
  $0 -h, --help          Show this help

Environment:
  DATABRICKS_PROFILE     CLI profile (default: DEFAULT)
  CLUSTER_ID            Cluster ID (default: auto-detect)

This script demonstrates:
  1. Listing workspace items
  2. Creating directories
  3. Importing notebooks
  4. Running code execution
  5. Listing Git repos
  6. Exporting workspace items
EOF
}

# Parse arguments
case "${1:-}" in
    -h|--help) show_help; exit 0 ;;
esac

# Override profile if provided
if [ -n "${1:-}" ]; then
    PROFILE="$1"
fi

main
