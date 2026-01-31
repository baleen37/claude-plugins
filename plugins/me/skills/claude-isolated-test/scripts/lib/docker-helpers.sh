#!/usr/bin/env bash
# docker-helpers.sh: Docker lifecycle management for Claude Code isolated test
set -euo pipefail

# Check if container exists
container_exists() {
    local container_name="$1"
    docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"
}

# Check if container is running
container_running() {
    local container_name="$1"
    docker ps --format '{{.Names}}' | grep -q "^${container_name}$"
}

# Create interactive container with tmux
create_interactive_container() {
    local container_name="$1"
    local image_name="$2"
    local oauth_token="$3"
    local workspace="${4:-$(pwd)}"

    if [ -z "$oauth_token" ] || [ "$oauth_token" = "null" ]; then
        echo "Error: OAuth token is empty" >&2
        return 1
    fi

    # Check if container already exists and is running
    if container_running "$container_name"; then
        echo "Container $container_name is already running" >&2
        return 0
    fi

    # Remove existing container if it exists but is stopped
    if container_exists "$container_name"; then
        echo "Removing existing container: $container_name" >&2
        docker rm "$container_name" &>/dev/null || true
    fi

    # Create new container with tty for interactive use
    docker run -d \
        --name "$container_name" \
        -e CLAUDE_CODE_OAUTH_TOKEN="$oauth_token" \
        -v "$workspace:/workspace" \
        -w /workspace \
        "$image_name" \
        sleep infinity
}

# Attach to container with tmux
attach_container_tmux() {
    local container_name="$1"

    if ! container_running "$container_name"; then
        echo "Error: Container $container_name is not running" >&2
        return 1
    fi

    # Start tmux session in container and attach
    docker exec -it "$container_name" tmux new-session -A -s claude
}
