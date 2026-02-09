# Advanced Claude Code Testing Patterns

Detailed hook testing patterns, debugging workflows, and advanced testing techniques.

## Hook Testing Patterns

### Three Hook Handler Types

#### 1. Command Hooks (Shell Scripts)

**Pattern:** Hook receives JSON via stdin, returns via exit code + stdout

```bash
#!/bin/bash
set -euo pipefail

# Read JSON from stdin
json_input=$(cat)

# Extract fields
command=$(echo "$json_input" | jq -r '.command // empty')

# Validate
if echo "$command" | grep -q -- "--no-verify"; then
    echo '{"ok": false, "reason": "--no-verify not allowed"}'
    exit 2  # Blocking error
fi

echo '{"ok": true}'
exit 0  # Success
```

**Exit codes:**
- `0` = Success, continue execution
- `2` = Blocking error, stop execution
- Other = Non-blocking error, log and continue

**Testing command hooks:**
```bash
# Test with BATS
@test "hook blocks --no-verify" {
    run bash -c "echo '{\"command\":\"git commit --no-verify\"}' | ./hook.sh"
    [ "$status" -eq 2 ]
    echo "$output" | jq -e '.ok == false'
}

@test "hook allows normal commit" {
    run bash -c "echo '{\"command\":\"git commit -m \\\"test\\\"\"}' | ./hook.sh"
    [ "$status" -eq 0 ]
    echo "$output" | jq -e '.ok == true'
}
```

#### 2. Prompt-Based Hooks (LLM Evaluation)

**Pattern:** Send hook input + prompt to Claude model (Haiku default)

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "prompt",
        "prompt": "Review this file change for security issues. Return {\"ok\": true} if safe, {\"ok\": false, \"reason\": \"...\"} if dangerous.",
        "timeout": 30
      }]
    }]
  }
}
```

**Testing prompt hooks:**
- Use `--debug` flag to see LLM responses
- Check hook execution in verbose mode (`Ctrl+O`)
- Verify timeout behavior (default 30s)
- Test with edge cases (empty input, malformed JSON)

#### 3. Agent-Based Hooks (Subagent Investigation)

**Pattern:** Spawn subagent with Read/Grep/Glob tools for complex verification

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write",
      "hooks": [{
        "type": "agent",
        "prompt": "Verify the written file follows project coding standards. Check: 1) No hardcoded secrets, 2) Follows naming conventions, 3) Has proper error handling.",
        "timeout": 60,
        "max_turns": 10
      }]
    }]
  }
}
```

**Testing agent hooks:**
- Monitor subagent execution in verbose mode
- Check turn count (default max 50, configurable)
- Verify timeout handling (default 60s)
- Test tool access (agents can use Read, Grep, Glob)

### Hook Output Fields

All hooks support JSON output with these fields:

```json
{
  "ok": true,                          // Continue execution (false = block)
  "reason": "Validation passed",        // Human-readable explanation
  "stopReason": "Quality gate failed",  // Stop entire session
  "suppressOutput": true,               // Hide hook output from user
  "systemMessage": "Added security check", // Message to Claude context
  "additionalContext": "...",          // Inject content into Claude's context
  "permissionDecision": "allow",       // PreToolUse only: allow/deny/ask
  "decision": {                        // PermissionRequest only
    "behavior": "allow"
  }
}
```

### Hook Events Reference

| Event | When Triggered | JSON Input |
|-------|----------------|------------|
| SessionStart | Session begins | `{"sessionId": "..."}` |
| SessionEnd | Session ends | `{"sessionId": "..."}` |
| UserPromptSubmit | User sends message | `{"prompt": "..."}` |
| PreToolUse | Before tool execution | `{"tool": "Bash", "command": "..."}` |
| PostToolUse | After tool succeeds | `{"tool": "Bash", "result": "..."}` |
| PostToolUseFailure | After tool fails | `{"tool": "Bash", "error": "..."}` |
| PermissionRequest | Permission needed | `{"tool": "Bash", "reason": "..."}` |
| SubagentStart | Subagent spawned | `{"agentId": "..."}` |
| SubagentStop | Subagent ends | `{"agentId": "..."}` |
| Stop | Session stopping | `{"reason": "..."}` |
| PreCompact | Before context compact | `{"contextSize": 100000}` |
| TaskCompleted | Task done | `{"taskId": "..."}` |
| TeammateIdle | No activity | `{"idleTime": 300}` |

## Debugging Workflows

### Hook Not Executing

1. Check hook is registered: `/hooks`
2. Verify matcher pattern matches tool name
3. Run with `--debug` to see hook execution
4. Check hook script has execute permissions: `chmod +x hook.sh`
5. Test hook directly with sample JSON

### Hook Executing But Wrong Result

1. Enable verbose mode: `Ctrl+O`
2. Check hook stdout/stderr in transcript
3. Verify exit code (0=allow, 2=block)
4. Test hook script in isolation with echo
5. Check JSON output format with `jq`

### SessionStart Hook Not Working

1. Verify it's not first conversation (known race condition)
2. Try `/clear` to retrigger hooks
3. Check `--debug` logs for hook execution
4. Verify stdout is captured (check with `echo "DEBUG"` in hook)
5. Test hook side effects (file writes, env vars) instead of stdout

### Trust Prompt Hangs

1. Verify tmux session is detached (`-d` flag)
2. Check trust prompt appears in capture: `tmux capture-pane -p`
3. Increase timeout for `wait_for_output`
4. Verify correct key sequence: `C-m` for Enter
5. Check for terminal size issues (use `-x 100 -y 30`)

## Testing PreToolUse/PostToolUse Hooks

### Pattern: Direct Execution with JSON stdin

**No tmux needed** - these hooks run synchronously

```bash
#!/bin/bash
# Test PreToolUse hook

HOOK_SCRIPT="./hooks/pretool-guard.sh"

# Test 1: Block dangerous command
echo "Test: Block --no-verify"
OUTPUT=$(echo '{"command":"git commit --no-verify -m \"test\""}' | "$HOOK_SCRIPT" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
    echo "✅ Successfully blocked dangerous command"
else
    echo "❌ Failed to block (exit code: $EXIT_CODE)"
    exit 1
fi

# Test 2: Allow normal command
echo "Test: Allow normal command"
OUTPUT=$(echo '{"command":"git commit -m \"normal\""}' | "$HOOK_SCRIPT" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Successfully allowed normal command"
else
    echo "❌ Failed to allow (exit code: $EXIT_CODE)"
    exit 1
fi

# Test 3: Verify JSON output
echo "Test: Verify JSON output format"
OUTPUT=$(echo '{"command":"git commit -m \"test\""}' | "$HOOK_SCRIPT" 2>&1)

if echo "$OUTPUT" | jq -e '.ok' >/dev/null 2>&1; then
    echo "✅ Valid JSON output"
else
    echo "❌ Invalid JSON output: $OUTPUT"
    exit 1
fi
```

## Testing MCP Server Integration

### Runtime Inspection

```bash
# In Claude session
/mcp

# Expected output:
# MCP Servers:
# - memory (status: connected)
# - filesystem (status: connected)
#
# Available tools:
# - mcp__memory__search
# - mcp__memory__store
# - mcp__filesystem__read
```

### Testing MCP Tools in Hooks

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "mcp__filesystem__write",
      "hooks": [{
        "type": "command",
        "command": "./hooks/validate-file-write.sh"
      }]
    }]
  }
}
```

**Pattern matching:**
- `mcp__<server>__<tool>` - Specific tool
- `mcp__memory__.*` - All tools from memory server
- `mcp__.*__write.*` - All write operations across servers

### Known Limitation (February 2026)

⚠️ **MCP Server Reload:** Changes to MCP configuration require Claude Code restart. No hot-reload available.

**Workaround:** Test MCP tools separately before integrating into hooks.

## Testing Best Practices

### 1. Architecture-First Testing

**Separate testable logic from hooks:**

```bash
# ❌ Bad: All logic in hook
#!/bin/bash
json_input=$(cat)
command=$(echo "$json_input" | jq -r '.command')
# ... 100 lines of validation logic ...

# ✅ Good: Extract to testable function
#!/bin/bash
source ./lib/validators.sh

json_input=$(cat)
command=$(echo "$json_input" | jq -r '.command')
validate_command "$command"  # Unit-testable function
```

**Benefits:**
- Test validation logic with unit tests
- Hook script becomes thin wrapper
- Easier debugging and maintenance

### 2. Progressive Testing Strategy

**Layer 1:** Unit test validation logic (fast, deterministic)
**Layer 2:** Test hook scripts with JSON stdin (isolated)
**Layer 3:** Test hooks in Claude Code with `--debug` (integrated)
**Layer 4:** Test full session lifecycle with tmux (E2E)

### 3. Use Fixtures for Consistent Testing

```bash
# tests/fixtures/hook-inputs/
# - valid-commit.json
# - dangerous-command.json
# - empty-input.json

@test "hook processes valid commit" {
    run bash -c "cat tests/fixtures/hook-inputs/valid-commit.json | ./hooks/guard.sh"
    [ "$status" -eq 0 ]
}
```

### 4. Test Error Paths

```bash
@test "hook handles malformed JSON" {
    run bash -c "echo 'not json' | ./hooks/guard.sh"
    [ "$status" -ne 0 ]
}

@test "hook handles missing command field" {
    run bash -c "echo '{}' | ./hooks/guard.sh"
    [ "$status" -eq 0 ]  # Should allow if no command
}

@test "hook handles jq not available" {
    run bash -c "PATH=/dev/null echo '{}' | ./hooks/guard.sh"
    # Verify graceful degradation
}
```

### 5. Document Known Issues

```markdown
## Known Issues (as of February 2026)

### SessionStart Race Condition
- **Issue:** Hooks fire before marketplace plugins load
- **Impact:** First-run context injection may fail
- **Workaround:** Use `/clear` to retrigger hooks
- **Status:** Tracked in anthropics/claude-code#10997
```

## Claude Code 2.1.0+ Features

### Hot Reload for Skills (24x Faster Testing)

**Before 2.1.0:** Edit → restart Claude Code → test (~2 minutes)
**After 2.1.0:** Edit → auto-reload → test (~5 seconds)

**Locations that auto-reload:**
- `~/.claude/skills/*/SKILL.md` - Global skills
- `.claude/skills/*/SKILL.md` - Project skills
- Plugin skills (via `--plugin-dir`)

**Testing workflow:**
```bash
# 1. Start Claude Code with plugin
claude --plugin-dir ./my-plugin

# 2. Edit skill in another terminal
vim ./my-plugin/skills/my-skill/SKILL.md

# 3. Test immediately (no restart needed)
# In Claude session: /my-skill
```

**What triggers reload:**
- File save to any SKILL.md
- Agent frontmatter changes
- Skill content updates

**What does NOT reload (requires restart):**
- Hooks configuration (hooks.json)
- Settings changes (settings.json)
- MCP server configuration
- Plugin manifest (plugin.json)

### Hooks in Frontmatter (2.1.0+)

Add scoped hooks directly in skill/agent YAML:

```yaml
---
name: secure-operations
description: Operations with security validation
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "${CLAUDE_PLUGIN_ROOT}/scripts/security-check.sh"
          timeout: 10
---
```

**Benefits:**
- Hooks scoped to specific skill/agent
- Version controlled with skill code
- Easier testing in isolation

### Forked Sub-agent Context (2.1.0+)

```yaml
---
name: experimental-feature
context: fork
---
```

**Use for testing:**
- Isolated testing without polluting main context
- Test new skill logic without side effects
- Parallel testing of different approaches

## Claude Models for Hook Evaluation

**Default:** Haiku (fast, cost-efficient)
**Custom:** Specify in hook config

```json
{
  "type": "prompt",
  "prompt": "Evaluate this change...",
  "model": "claude-sonnet-4-5"  // Override default Haiku
}
```

**Recommendations:**
- Use **Haiku** for real-time hooks (30s timeout default)
- Use **Sonnet** for complex analysis (increase timeout to 60s)
- Use **Opus** for critical security reviews (increase timeout to 120s)

## Resources

### Official Documentation
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) - Complete hook specification
- [Claude Code Plugins](https://code.claude.com/docs/en/plugins) - Plugin development guide
- [Claude Code Docs](https://code.claude.com/docs/en/overview) - Official overview

### Release Notes
- [Claude Code 2.1.0](https://github.com/anthropics/claude-code/releases/tag/v2.1.0) - Hot-reload, frontmatter hooks
- [Claude Opus 4.6](https://www.anthropic.com/news/claude-opus-46) - Testing capabilities

### Community Resources
- [Claude Code Hooks Mastery](https://github.com/disler/claude-code-hooks-mastery) - Hook examples
- [TDD Guard](https://github.com/nizos/tdd-guard) - Automated TDD enforcement
- [Official Plugin Marketplace](https://code.claude.com/plugins) - Verified plugins

### GitHub Issues (Known Problems)
- [#10373](https://github.com/anthropics/claude-code/issues/10373) - SessionStart hooks new conversation
- [#9591](https://github.com/anthropics/claude-code/issues/9591) - SessionStart context not displayed
- [#10997](https://github.com/anthropics/claude-code/issues/10997) - SessionStart marketplace plugin race
