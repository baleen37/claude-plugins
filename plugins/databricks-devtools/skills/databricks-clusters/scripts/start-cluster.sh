#!/usr/bin/env bash
#
# start-cluster.sh
#
# Start a Databricks cluster and wait for it to be ready.
# Usage: ./start-cluster.sh <cluster-id> [--timeout <seconds>]
#
# Example: ./start-cluster.sh 1234-567890-abcde --timeout 600
#

set -euo pipefail

DEFAULT_TIMEOUT=600
TIMEOUT=${TIMEOUT:-$DEFAULT_TIMEOUT}
CLUSTER_ID=""
PROFILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    -*)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
    *)
      CLUSTER_ID="$1"
      shift
      ;;
  esac
done

if [[ -z "$CLUSTER_ID" ]]; then
  echo "Error: Cluster ID is required" >&2
  echo "Usage: $0 <cluster-id> [--timeout <seconds>] [--profile <profile>]" >&2
  exit 1
fi

# Build profile flag if provided
PROFILE_FLAG=""
if [[ -n "$PROFILE" ]]; then
  PROFILE_FLAG="--profile $PROFILE"
fi

echo "Starting cluster: $CLUSTER_ID"
echo "Timeout: ${TIMEOUT}s"

# Start the cluster
eval "databricks clusters start $PROFILE_FLAG --cluster-id $CLUSTER_ID" || {
  echo "Failed to start cluster" >&2
  exit 1
}

# Wait for cluster to be running
echo "Waiting for cluster to be ready..."
STARTED_AT=$(date +%s)
EXPIRES_AT=$((STARTED_AT + TIMEOUT))

while true; do
  NOW=$(date +%s)

  # Check timeout
  if [[ $NOW -ge $EXPIRES_AT ]]; then
    echo "Timeout waiting for cluster to start" >&2
    exit 1
  fi

  # Get cluster status
  STATE=$(eval "databricks clusters get $PROFILE_FLAG --cluster-id $CLUSTER_ID --output json" | jq -r '.state')

  case "$STATE" in
    RUNNING)
      echo "✓ Cluster is running and ready"
      exit 0
      ;;
    PENDING|RESTARTING|RESIZING)
      ELAPSED=$((NOW - STARTED_AT))
      echo "Cluster state: $STATE (${ELAPSED}s elapsed)..."
      sleep 10
      ;;
    TERMINATED)
      echo "✗ Cluster was terminated" >&2
      exit 1
      ;;
    TERMINATING)
      echo "✗ Cluster is terminating" >&2
      exit 1
      ;;
    ERROR)
      echo "✗ Cluster is in error state" >&2
      exit 1
      ;;
    *)
      echo "Unknown cluster state: $STATE" >&2
      exit 1
      ;;
  esac
done
