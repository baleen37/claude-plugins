#!/bin/bash
# Test multiple configurations in parallel using tmux
# Usage: ./parallel-testing.sh

set -euo pipefail

# Test configurations
declare -a CONFIGS=(
    "config-a:./plugin-a"
    "config-b:./plugin-b"
    "config-c:./plugin-c"
)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Track all session names for cleanup
declare -a SESSION_NAMES=()

# Cleanup trap
trap cleanup EXIT

cleanup() {
    echo -e "${YELLOW}Cleaning up all test sessions...${NC}"
    for session in "${SESSION_NAMES[@]}"; do
        tmux kill-session -t "$session" 2>/dev/null || true
    done
}

# Start a single test instance
start_test_instance() {
    local config_name="$1"
    local plugin_dir="$2"
    local session_name="claude-test-$config_name-$$-$RANDOM"

    echo -e "${YELLOW}Starting test instance: $config_name${NC}"
    echo "  Plugin: $plugin_dir"
    echo "  Session: $session_name"

    # Create detached session
    tmux new-session -d -s "$session_name" -x 100 -y 30

    # Navigate and start Claude
    tmux send-keys -t "$session_name" "cd '$(pwd)'" C-m
    tmux send-keys -t "$session_name" "claude --plugin-dir '$plugin_dir' --debug" C-m

    # Store session name for later
    SESSION_NAMES+=("$session_name")

    echo -e "${GREEN}✅ Started: $session_name${NC}"
}

# Wait for trust prompt and accept
handle_trust_prompt() {
    local session_name="$1"
    local max_attempts=20
    local attempts=0

    echo -e "${YELLOW}Waiting for trust prompt: $session_name${NC}"

    while [ $attempts -lt $max_attempts ]; do
        OUTPUT=$(tmux capture-pane -t "$session_name" -p 2>/dev/null || echo "")
        if echo "$OUTPUT" | grep -q "Yes, proceed"; then
            echo -e "${GREEN}✅ Trust prompt found: $session_name${NC}"
            tmux send-keys -t "$session_name" C-m
            return 0
        fi
        sleep 0.5
        attempts=$((attempts + 1))
    done

    echo -e "${RED}❌ Trust prompt timeout: $session_name${NC}"
    return 1
}

# Wait for Claude ready
wait_for_ready() {
    local session_name="$1"
    local max_attempts=20
    local attempts=0

    echo -e "${YELLOW}Waiting for Claude ready: $session_name${NC}"

    while [ $attempts -lt $max_attempts ]; do
        OUTPUT=$(tmux capture-pane -t "$session_name" -p 2>/dev/null || echo "")
        if echo "$OUTPUT" | grep -q "claude-sonnet"; then
            echo -e "${GREEN}✅ Claude ready: $session_name${NC}"
            return 0
        fi
        sleep 0.5
        attempts=$((attempts + 1))
    done

    echo -e "${RED}❌ Claude ready timeout: $session_name${NC}"
    return 1
}

# Send test prompt to session
send_test_prompt() {
    local session_name="$1"
    local test_prompt="${2:-Test the plugin configuration}"

    echo -e "${YELLOW}Sending test prompt: $session_name${NC}"
    tmux send-keys -t "$session_name" "$test_prompt" C-m
    sleep 2
    echo -e "${GREEN}✅ Prompt sent: $session_name${NC}"
}

# Capture and display output
capture_output() {
    local session_name="$1"

    echo ""
    echo -e "${GREEN}=== Output from: $session_name ===${NC}"
    tmux capture-pane -t "$session_name" -p -S -50
    echo ""
}

main() {
    echo -e "${GREEN}=== Starting Parallel Testing ===${NC}"
    echo "Testing ${#CONFIGS[@]} configurations"
    echo ""

    # Step 1: Start all test instances in parallel
    echo -e "${YELLOW}Step 1: Starting all instances...${NC}"
    for config in "${CONFIGS[@]}"; do
        IFS=':' read -r config_name plugin_dir <<< "$config"
        start_test_instance "$config_name" "$plugin_dir"
        sleep 1  # Small delay to stagger starts
    done

    echo ""
    echo -e "${GREEN}All instances started${NC}"
    echo ""

    # Step 2: Handle trust prompts for all sessions
    echo -e "${YELLOW}Step 2: Handling trust prompts...${NC}"
    for session in "${SESSION_NAMES[@]}"; do
        handle_trust_prompt "$session" || echo -e "${RED}Failed: $session${NC}"
    done

    echo ""
    echo -e "${GREEN}All trust prompts handled${NC}"
    echo ""

    # Step 3: Wait for all instances to be ready
    echo -e "${YELLOW}Step 3: Waiting for all instances to be ready...${NC}"
    for session in "${SESSION_NAMES[@]}"; do
        wait_for_ready "$session" || echo -e "${RED}Failed: $session${NC}"
    done

    echo ""
    echo -e "${GREEN}All instances ready${NC}"
    echo ""

    # Step 4: Send test prompts to all sessions
    echo -e "${YELLOW}Step 4: Sending test prompts...${NC}"
    for session in "${SESSION_NAMES[@]}"; do
        send_test_prompt "$session" "Test the plugin configuration"
    done

    echo ""
    echo -e "${GREEN}All test prompts sent${NC}"
    echo ""

    # Step 5: Capture output from all sessions
    echo -e "${YELLOW}Step 5: Capturing outputs...${NC}"
    for session in "${SESSION_NAMES[@]}"; do
        capture_output "$session"
    done

    # Step 6: List all running sessions
    echo -e "${GREEN}=== Active Test Sessions ===${NC}"
    tmux list-sessions | grep "^claude-test-" || echo "No active sessions"

    echo ""
    echo -e "${GREEN}=== Parallel Testing Complete ===${NC}"
    echo "To attach to a specific session:"
    for session in "${SESSION_NAMES[@]}"; do
        echo "  tmux attach-session -t $session"
    done
    echo ""
    echo "To kill all sessions manually:"
    echo "  for s in ${SESSION_NAMES[*]}; do tmux kill-session -t \$s; done"
}

# Run main function
main "$@"
