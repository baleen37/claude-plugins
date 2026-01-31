#!/usr/bin/env bash
# attach-container.sh: Attach to a Claude Code Docker container with tmux
set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source helper libraries
source "$SCRIPT_DIR/lib/docker-helpers.sh"

# Default values
IMAGE_NAME="${CLAUDE_TEST_IMAGE:-claude-test:latest}"
CONTAINER_NAME="${CLAUDE_CONTAINER_NAME:-claude-dev}"
WORKSPACE="${WORKSPACE:-$(pwd)}"

# Usage
usage() {
    echo "Usage: $0 [options]" >&2
    echo "" >&2
    echo "Attach to a Claude Code Docker container with tmux for interactive development." >&2
    echo "" >&2
    echo "Options:" >&2
    echo "  -n, --name NAME      Container name (default: claude-dev)" >&2
    echo "  -i, --image IMAGE    Docker image name (default: claude-test:latest)" >&2
    echo "  -w, --workspace DIR  Workspace directory to mount (default: current dir)" >&2
    echo "  -s, --stop-only      Stop and remove the container without attaching" >&2
    echo "  -h, --help           Show this help" >&2
    exit 1
}

# Parse arguments
STOP_ONLY=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        -i|--image)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -w|--workspace)
            WORKSPACE="$2"
            shift 2
            ;;
        -s|--stop-only)
            STOP_ONLY=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            ;;
    esac
done

# Stop-only mode
if [ "$STOP_ONLY" = true ]; then
    if container_exists "$CONTAINER_NAME"; then
        echo "Stopping container: $CONTAINER_NAME" >&2
        docker stop "$CONTAINER_NAME" &>/dev/null || true
        docker rm "$CONTAINER_NAME" &>/dev/null || true
        echo "Container stopped and removed" >&2
    else
        echo "No container found: $CONTAINER_NAME" >&2
    fi
    exit 0
fi

# Check Docker availability
if ! check_docker_available; then
    echo "Error: Docker is not available or not running" >&2
    exit 1
fi

# Check if image exists, build if needed
if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
    echo "Image not found. Building $IMAGE_NAME..." >&2
    build_claude_image "$IMAGE_NAME" "$SCRIPT_DIR/../docker"
fi

# Get OAuth token from Keychain (macOS) or environment
if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
    TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"
    echo "Using OAuth token from environment" >&2
elif command -v security &>/dev/null; then
    echo "Getting OAuth token from Keychain..." >&2
    TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | jq -r '.claudeAiOauth.accessToken' || echo "")
else
    echo "Warning: No OAuth token found. Set CLAUDE_CODE_OAUTH_TOKEN environment variable." >&2
    TOKEN=""
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "Error: OAuth token not available." >&2
    echo "Set CLAUDE_CODE_OAUTH_TOKEN environment variable or ensure Keychain has 'Claude Code-credentials'." >&2
    exit 1
fi

# Create or reuse container
echo "========================================"
echo "Container: $CONTAINER_NAME"
echo "Image: $IMAGE_NAME"
echo "Workspace: $WORKSPACE"
echo "========================================" >&2

create_interactive_container "$CONTAINER_NAME" "$IMAGE_NAME" "$TOKEN" "$WORKSPACE"

echo "" >&2
echo "Attaching to container with tmux..." >&2
echo "Press Ctrl+B then D to detach without stopping the container" >&2
echo "Run '$0 --stop-only' to stop and remove the container" >&2
echo "" >&2

# Attach with tmux
attach_container_tmux "$CONTAINER_NAME"
