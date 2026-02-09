---
name: claude-isolated-test
description: This skill should be used when the user asks to "test Claude Code in isolated environments", "test in fresh instance", "test SessionStart hooks", "use tmux for testing", "test with Docker", mentions "packnplay", or needs to "sandbox dangerous plugin changes" before deployment.
version: 1.0.0
---

# Claude Code Isolated Testing

## Overview

Test Claude Code configuration, plugins, and hooks in isolated environments. Focus on fresh instance testing using tmux, Docker containers, and worktrees for safe, reproducible testing.

**Core principle:** Test in isolation to avoid context pollution, use fresh instances for hook testing, automate trust prompt handling.

## When to Use

**Use when:**
- Testing SessionStart/SessionStop hooks requiring fresh instances
- Testing dangerous or risky plugin changes
- Need reproducible test environment across machines
- Testing configuration changes without affecting main workspace
- Automating Claude Code testing in CI/CD
- Testing multiple configurations in parallel

**Don't use when:**
- Testing application code (use language-specific test frameworks)
- Simple PreToolUse/PostToolUse hooks (test with JSON stdin directly)
- Editing files in current session (no isolation needed)

## Quick Reference

| Method | Isolation Level | Setup | Best For |
|--------|----------------|-------|----------|
| **tmux sessions** | Fresh process | Low | SessionStart hooks, trust prompts |
| **Git worktrees** | Filesystem | Low | Concurrent branch testing |
| **Docker/packnplay** | Complete | Medium | Security, reproducibility |
| **Environment vars** | State only | Very Low | Hook environment testing |

## Fresh Instance Methods

### Method 1: tmux Sessions (Most Common)

**Pattern:** Create isolated tmux session with new Claude Code process

```bash
#!/bin/bash
set -euo pipefail

SESSION_NAME="claude-test-$$-$RANDOM"
PROJECT_DIR="/path/to/test/project"

# CRITICAL: Cleanup trap to prevent zombie sessions
trap "tmux kill-session -t '$SESSION_NAME' 2>/dev/null || true" EXIT

# Create detached tmux session (-d is critical)
tmux new-session -d -s "$SESSION_NAME" -x 100 -y 30
tmux send-keys -t "$SESSION_NAME" "cd $PROJECT_DIR" C-m

# Start Claude with test configuration
tmux send-keys -t "$SESSION_NAME" "claude --plugin-dir ./test-plugin --debug" C-m

# Wait for trust prompt with polling
wait_for_output "$SESSION_NAME" "Yes, proceed" 20
tmux send-keys -t "$SESSION_NAME" C-m

# Wait for Claude ready
wait_for_output "$SESSION_NAME" "claude-sonnet" 20

# Send test prompt
tmux send-keys -t "$SESSION_NAME" "Test the hook configuration" C-m
sleep 2

# Capture output
OUTPUT=$(tmux capture-pane -t "$SESSION_NAME" -p -S -100)
echo "$OUTPUT"

# Cleanup via trap
```

**Polling helper function:**

```bash
wait_for_output() {
    local session="$1"
    local expected="$2"
    local max_attempts="${3:-20}"
    local attempts=0

    while [ $attempts -lt $max_attempts ]; do
        OUTPUT=$(tmux capture-pane -t "$session" -p)
        if echo "$OUTPUT" | grep -q "$expected"; then
            return 0
        fi
        sleep 0.5
        attempts=$((attempts + 1))
    done

    echo "Timeout waiting for: $expected" >&2
    tmux capture-pane -t "$session" -p >&2
    return 1
}
```

**Critical requirements:**
- ✅ Always use trap for cleanup
- ✅ Use `-d` flag (detached session)
- ✅ Unique session names (`$$-$RANDOM`)
- ✅ Polling over sleep for reliability

**Apply this method when:**
- Testing SessionStart/SessionStop hooks
- Requiring fresh Claude Code process
- Automating trust prompt handling
- Testing configuration changes requiring restart

**Reference:** See `examples/tmux-fresh-instance.sh` for complete working example

### Method 2: Docker/packnplay (Security & Reproducibility)

**Pattern:** Run Claude in isolated container with controlled access

```bash
#!/bin/bash

# Option A: packnplay (automatic worktree + container)
packnplay run --worktree=test-feature claude --plugin-dir ./test-plugin

# Option B: Direct docker
docker run -it \
    -v "$(pwd):/workspace" \
    -e ANTHROPIC_API_KEY \
    ghcr.io/obra/packnplay/devcontainer:latest \
    claude --plugin-dir /workspace/test-plugin
```

**Apply this method when:**
- Testing dangerous or risky changes
- Requiring security boundaries (filesystem, network)
- Testing across different OS environments
- Automating in CI/CD pipelines

### Method 3: Git Worktrees (Filesystem Isolation)

**Pattern:** Create isolated workspaces with independent file state

```bash
#!/bin/bash

BRANCH_NAME="test-feature-$$"
WORKTREE_PATH=".worktrees/$BRANCH_NAME"

# Create isolated worktree
git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"
cd "$WORKTREE_PATH"

# Install dependencies in isolated space
bun install

# Run Claude in isolated workspace
claude --plugin-dir ./test-plugin

# Cleanup
cd -
git worktree remove "$WORKTREE_PATH"
```

**Apply this method when:**
- Testing multiple branches concurrently
- Requiring independent dependency installations
- Needing filesystem-level isolation

**Reference:** See `using-git-worktrees` skill for complete workflow

### Method 4: Environment Variables (State Isolation)

**Pattern:** Isolate state via environment files

```bash
#!/bin/bash

TEST_ID="$$-$RANDOM"
ENV_FILE="/tmp/claude-test-env-$TEST_ID"

# Set environment file for this session
export CLAUDE_ENV_FILE="$ENV_FILE"

# Create isolated environment
cat > "$ENV_FILE" << EOF
export TEST_MODE=true
export TEST_ID="$TEST_ID"
export LOG_FILE="/tmp/test-$TEST_ID.log"
EOF

# Run Claude with isolated environment
claude --plugin-dir ./test-plugin

# Verify test artifacts
if [ -f "/tmp/test-$TEST_ID.log" ]; then
    echo "✅ Test completed"
fi

# Cleanup
rm -f "$ENV_FILE" "/tmp/test-$TEST_ID.log"
```

**Apply this method when:**
- Testing SessionStart hooks that set environment
- Requiring per-test environment isolation

## Testing SessionStart/SessionStop Hooks

### Known Issues (as of February 2026)

⚠️ **Race Condition:** SessionStart hooks fire before marketplace plugins fully load
⚠️ **Output Injection:** SessionStart stdout not processed for new conversations
⚠️ **Workaround:** Use `/clear`, `/compact`, or resume to trigger hooks correctly

### Testing Pattern with tmux

```bash
#!/bin/bash
set -euo pipefail

SESSION_NAME="sessionstart-test-$$-$RANDOM"
ENV_FILE="/tmp/test-env-$$"

# Cleanup trap
trap "tmux kill-session -t '$SESSION_NAME' 2>/dev/null || true" EXIT

# Setup environment
export CLAUDE_ENV_FILE="$ENV_FILE"
rm -f "$ENV_FILE"

# Start Claude Code in tmux
tmux new-session -d -s "$SESSION_NAME" -x 100 -y 30
tmux send-keys -t "$SESSION_NAME" "cd /path/to/project" C-m

# Launch Claude and wait for trust prompt
tmux send-keys -t "$SESSION_NAME" "claude --debug" C-m
wait_for_output "$SESSION_NAME" "Yes, proceed" 20

# Respond to trust prompt
tmux send-keys -t "$SESSION_NAME" C-m
wait_for_output "$SESSION_NAME" "claude-sonnet" 20

# Wait for SessionStart hook to execute
sleep 2

# Verify SessionStart hook side effects
if grep -q "SESSION_ID" "$ENV_FILE"; then
    echo "✅ SessionStart hook executed"
else
    echo "❌ SessionStart hook failed"
    exit 1
fi

# Test SessionEnd
tmux send-keys -t "$SESSION_NAME" "/exit" C-m
sleep 1

if grep -q "SESSION_ENDED" "$ENV_FILE"; then
    echo "✅ SessionEnd hook executed"
else
    echo "❌ SessionEnd hook failed"
    exit 1
fi
```

**Reference:** See `examples/sessionstart-test.sh` for complete implementation

## Common Testing Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Not using trap | Zombie sessions accumulate | `trap "tmux kill-session..." EXIT` |
| Hardcoded session names | Tests collide | Use `test-$$-$RANDOM` |
| Using sleep blindly | Flaky or slow tests | Use polling with `wait_for_output` |
| Forgetting `-d` flag | tmux blocks script | Always use detached mode |
| Ignoring SessionStart race | New conversation tests fail | Use `/clear` workaround |

## Testing Workflow

### 1. Start with Simplest Method

```bash
# For PreToolUse/PostToolUse hooks - NO tmux needed
echo '{"command":"git commit -m test"}' | ./hooks/guard.sh
```

### 2. Use tmux for Fresh Instance Needs

```bash
# For SessionStart or configuration changes
./examples/tmux-fresh-instance.sh
```

### 3. Use Docker for Security/Reproducibility

```bash
# For dangerous changes or CI/CD
packnplay run --worktree=test-feature claude
```

### 4. Debug with Flags

```bash
# Always use debug during development
claude --debug

# Check hook execution in session
Ctrl+O  # Toggle verbose mode
/hooks  # List registered hooks
```

## Configuration Files

| File | Purpose | Reload |
|------|---------|--------|
| `.claude/skills/*/SKILL.md` | Skill definitions | ✅ Hot-reload 2.1.0+ |
| `.claude/agents/*/AGENT.md` | Agent definitions | ✅ Hot-reload 2.1.0+ |
| `.claude/settings.json` | Hooks configuration | ❌ Requires restart |
| `.claude-plugin/plugin.json` | Plugin manifest | ❌ Requires restart |

## Additional Resources

### Examples

Working scripts in `examples/`:
- **`tmux-fresh-instance.sh`** - Complete tmux testing script
- **`sessionstart-test.sh`** - SessionStart/SessionStop hook testing
- **`parallel-testing.sh`** - Multiple configurations in parallel

### Reference Files

For detailed patterns:
- **`references/advanced-testing.md`** - Hook testing patterns, debugging workflows

### Scripts

Utilities in `scripts/`:
- **`wait-for-output.sh`** - Reusable polling helper for tmux output detection

## Quick Decision Tree

```
Need fresh Claude Code process?
├─ Yes → tmux Sessions
└─ No → Continue

Need security isolation or reproducibility?
├─ Yes → Docker/packnplay
└─ No → Continue

Testing multiple branches concurrently?
├─ Yes → Git Worktrees
└─ No → Continue

Testing environment-dependent hooks?
├─ Yes → Environment Variables
└─ No → Simple JSON stdin test
```

## Resources

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) - Official hooks specification
- [Claude Code 2.1.0 Release](https://github.com/anthropics/claude-code/releases/tag/v2.1.0) - Hot-reload features
- [packnplay Documentation](https://github.com/obra/packnplay) - Container testing tool
