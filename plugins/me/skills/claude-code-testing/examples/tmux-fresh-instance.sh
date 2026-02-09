#!/bin/bash
# Complete tmux fresh instance testing script
# Usage: ./tmux-fresh-instance.sh [project-dir] [plugin-dir]

set -euo pipefail

# Configuration
PROJECT_DIR="${1:-.}"
PLUGIN_DIR="${2:-./plugin}"
SESSION_NAME="claude-test-$$-$RANDOM"
TRUST_PROMPT_TIMEOUT=20  # 10 seconds (20 × 0.5s)
READY_TIMEOUT=20         # 10 seconds

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cleanup trap - CRITICAL to prevent zombie sessions
trap cleanup EXIT

cleanup() {
    echo -e "${YELLOW}Cleaning up tmux session: $SESSION_NAME${NC}"
    tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
}

# Polling helper function
wait_for_output() {
    local session="$1"
    local expected="$2"
    local max_attempts="${3:-20}"
    local attempts=0

    echo -e "${YELLOW}Waiting for: $expected${NC}"

    while [ $attempts -lt $max_attempts ]; do
        OUTPUT=$(tmux capture-pane -t "$session" -p)
        if echo "$OUTPUT" | grep -q "$expected"; then
            echo -e "${GREEN}✅ Found: $expected${NC}"
            return 0
        fi
        sleep 0.5
        attempts=$((attempts + 1))
    done

    echo -e "${RED}❌ Timeout waiting for: $expected${NC}"
    echo -e "${YELLOW}Current output:${NC}"
    tmux capture-pane -t "$session" -p >&2
    return 1
}

main() {
    echo -e "${GREEN}=== Starting Fresh Claude Instance Test ===${NC}"
    echo "Project: $PROJECT_DIR"
    echo "Plugin: $PLUGIN_DIR"
    echo "Session: $SESSION_NAME"
    echo ""

    # Step 1: Create detached tmux session
    echo -e "${YELLOW}1. Creating tmux session...${NC}"
    tmux new-session -d -s "$SESSION_NAME" -x 100 -y 30
    echo -e "${GREEN}✅ Session created${NC}"

    # Step 2: Navigate to project directory
    echo -e "${YELLOW}2. Navigating to project...${NC}"
    tmux send-keys -t "$SESSION_NAME" "cd '$PROJECT_DIR'" C-m
    sleep 0.5

    # Step 3: Launch Claude Code
    echo -e "${YELLOW}3. Launching Claude Code...${NC}"
    tmux send-keys -t "$SESSION_NAME" "claude --plugin-dir '$PLUGIN_DIR' --debug" C-m

    # Step 4: Wait for trust prompt
    echo -e "${YELLOW}4. Waiting for trust prompt...${NC}"
    if ! wait_for_output "$SESSION_NAME" "Yes, proceed" $TRUST_PROMPT_TIMEOUT; then
        echo -e "${RED}❌ Trust prompt not found${NC}"
        exit 1
    fi

    # Step 5: Respond to trust prompt
    echo -e "${YELLOW}5. Accepting trust prompt...${NC}"
    tmux send-keys -t "$SESSION_NAME" C-m

    # Step 6: Wait for Claude to be ready
    echo -e "${YELLOW}6. Waiting for Claude ready...${NC}"
    if ! wait_for_output "$SESSION_NAME" "claude-sonnet" $READY_TIMEOUT; then
        echo -e "${RED}❌ Claude did not start${NC}"
        exit 1
    fi

    # Step 7: Send test prompt
    echo -e "${YELLOW}7. Sending test prompt...${NC}"
    tmux send-keys -t "$SESSION_NAME" "Hello, test the plugin" C-m
    sleep 3

    # Step 8: Capture and display output
    echo -e "${YELLOW}8. Capturing output...${NC}"
    OUTPUT=$(tmux capture-pane -t "$SESSION_NAME" -p -S -50)

    echo ""
    echo -e "${GREEN}=== Claude Output ===${NC}"
    echo "$OUTPUT"
    echo ""

    # Step 9: Exit Claude
    echo -e "${YELLOW}9. Exiting Claude...${NC}"
    tmux send-keys -t "$SESSION_NAME" "/exit" C-m
    sleep 1

    echo -e "${GREEN}=== Test Complete ===${NC}"
}

# Run main function
main "$@"
