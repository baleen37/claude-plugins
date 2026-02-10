#!/usr/bin/env bash
#
# cleanup-clusters.sh
#
# Stop idle Databricks clusters that have been running longer than specified.
# Usage: ./cleanup-clusters.sh [--idle-minutes <minutes>] [--dry-run] [--profile <profile>]
#
# Examples:
#   ./cleanup-clusters.sh --dry-run                    # Show what would be stopped
#   ./cleanup-clusters.sh --idle-minutes 30            # Stop clusters idle > 30 min
#   ./cleanup-clusters.sh --idle-minutes 60 --profile prod
#

set -euo pipefail

IDLE_MINUTES=60
DRY_RUN=false
PROFILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --idle-minutes)
      IDLE_MINUTES="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --idle-minutes <minutes>  Stop clusters idle longer than this (default: 60)"
      echo "  --dry-run                 Show what would be stopped without stopping"
      echo "  --profile <profile>       Databricks CLI profile to use"
      echo "  -h, --help                Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Build profile flag if provided
PROFILE_FLAG=""
if [[ -n "$PROFILE" ]]; then
  PROFILE_FLAG="--profile $PROFILE"
fi

echo "Looking for clusters idle for more than ${IDLE_MINUTES} minutes..."

# Get list of running clusters
CLUSTERS=$(eval "databricks clusters list $PROFILE_FLAG --output json")

# Calculate idle threshold in milliseconds (current time - threshold)
NOW=$(date +%s)
THRESHOLD_SECONDS=$((NOW - IDLE_MINUTES * 60))

# Process each cluster
echo "$CLUSTERS" | jq -r '.[] | @json' | while read -r cluster; do
  CLUSTER_ID=$(echo "$cluster" | jq -r '.cluster_id')
  CLUSTER_NAME=$(echo "$cluster" | jq -r '.cluster_name')
  STATE=$(echo "$cluster" | jq -r '.state')

  # Only process running clusters
  if [[ "$STATE" != "RUNNING" ]]; then
    continue
  fi

  # Get detailed cluster info to check last activity
  CLUSTER_INFO=$(eval "databricks clusters get $PROFILE_FLAG --cluster-id $CLUSTER_ID --output json")

  # Check last activity (last_active is in milliseconds since epoch)
  LAST_ACTIVE_MS=$(echo "$CLUSTER_INFO" | jq -r '.last_activity_time_ms // empty')

  if [[ -z "$LAST_ACTIVE_MS" ]]; then
    echo "Skipping $CLUSTER_NAME: no activity data"
    continue
  fi

  LAST_ACTIVE_SEC=$((LAST_ACTIVE_MS / 1000))
  IDLE_MINUTES_ACTUAL=$(( (NOW - LAST_ACTIVE_SEC) / 60 ))

  if [[ $LAST_ACTIVE_SEC -lt $THRESHOLD_SECONDS ]]; then
    echo "  ✓ $CLUSTER_NAME: active (idle ${IDLE_MINUTES_ACTUAL} minutes)"
    continue
  fi

  # Cluster is idle beyond threshold
  if [[ "$DRY_RUN" == true ]]; then
    echo "  [DRY RUN] Would stop: $CLUSTER_NAME (idle ${IDLE_MINUTES_ACTUAL} minutes)"
  else
    echo "  Stopping: $CLUSTER_NAME (idle ${IDLE_MINUTES_ACTUAL} minutes)"
    eval "databricks clusters stop $PROFILE_FLAG --cluster-id $CLUSTER_ID" || {
      echo "    Failed to stop cluster" >&2
    }
  fi
done

if [[ "$DRY_RUN" == true ]]; then
  echo ""
  echo "Dry run complete. No clusters were stopped."
  echo "Run without --dry-run to actually stop idle clusters."
else
  echo ""
  echo "Cleanup complete."
fi
