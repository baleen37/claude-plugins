#!/usr/bin/env bash
# docker-helpers.sh: Docker lifecycle management functions for Claude Code testing
set -euo pipefail

# Check Docker availability and daemon
check_docker_available() {
    command -v docker &>/dev/null && docker ps &>/dev/null
}

# Build Claude Code test image
build_claude_image() {
    local image_name="${1:-claude-test}"
    local docker_context="${2:-./docker}"
    echo "Building Docker image: $image_name from $docker_context"
    docker build -t "$image_name" "$docker_context"
}

# Create and start container
create_container() {
    local container_name="$1"
    local image_name="$2"
    local oauth_token="$3"
    local workspace="${4:-$(pwd)}"

    if [ -z "$oauth_token" ] || [ "$oauth_token" = "null" ]; then
        echo "Error: OAuth token is empty" >&2
        return 1
    fi

    docker run -d \
        --name "$container_name" \
        -e CLAUDE_CODE_OAUTH_TOKEN="$oauth_token" \
        -v "$workspace:/workspace" \
        -w /workspace \
        "$image_name" \
        sleep infinity
}

# Execute command in container (output to stdout)
exec_in_container() {
    local container_name="$1"
    shift
    docker exec "$container_name" "$@"
}

# Execute command in container (capture output)
exec_in_container_capture() {
    local container_name="$1"
    shift
    docker exec "$container_name" "$@" 2>&1
}

# Wait for Claude Code CLI to be ready
wait_for_claude_ready() {
    local container_name="$1"
    local timeout="${2:-30}"
    local elapsed=0

    echo "Waiting for Claude Code to be ready (timeout: ${timeout}s)..." >&2

    while [ $elapsed -lt $timeout ]; do
        if docker exec "$container_name" bash -c "command -v claude" >/dev/null 2>&1; then
            echo "Claude Code is ready" >&2
            return 0
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    echo "Timeout waiting for Claude Code in container" >&2
    return 1
}

# Get container logs
get_container_logs() {
    local container_name="$1"
    docker logs "$container_name" 2>&1
}

# Cleanup container
cleanup_container() {
    local container_name="$1"
    if container_exists "$container_name"; then
        echo "Cleaning up container: $container_name" >&2
        docker stop "$container_name" &>/dev/null || true
        docker rm "$container_name" &>/dev/null || true
    fi
}

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
