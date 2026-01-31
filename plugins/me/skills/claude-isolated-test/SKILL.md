---
name: isolated-claude-testing
description: Use when needing to test Claude Code in an isolated Docker container, or when user asks about sandboxed, safe, or containerized Claude testing environment
---

# Isolated Claude Testing

Run Claude Code in isolated Docker containers using packnplay for safe testing.

## When to Use

- Isolated/sandboxed Claude Code testing
- Testing dangerous code changes
- Evaluating Claude performance in clean environments
- Port forwarding for web server testing
- Multiple concurrent test sessions

## Quick Reference

| Task | Command |
|------|---------|
| Install | `go install github.com/obra/packnplay@latest` |
| Run | `packnplay run claude` |
| Port mapping | `packnplay run -p 3000:3000 claude` |
| With credentials | `packnplay run --ssh-creds --gh-creds claude` |
| List | `packnplay list` |
| Stop | `packnplay stop <name>` |

## Installation

```bash
go install github.com/obra/packnplay@latest
```

**Requirements:** Go 1.21+, Docker running

## Authentication

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
packnplay run claude
```

## Common Operations

```bash
# With credentials (git push, GitHub CLI)
packnplay run --ssh-creds --gh-creds claude

# Worktree isolation
packnplay run --worktree feature-branch claude

# Port forwarding
packnplay run -p 3000:3000 -p 8080:8080 claude

# List running containers
packnplay list

# Stop container
packnplay stop <container-name>
```

## Web Server Testing

```bash
# Start with port mapping
packnplay run -p 3000:3000 claude

# Inside container: start server
cd /workspace && npm run dev

# Access from host: http://localhost:3000
```

**Port conflicts:** `lsof -i :3000` to find conflicts, use `-p 3001:3000` for alternate port.

## Default Container

- **Image:** `ghcr.io/obra/packnplay/devcontainer:latest`
- **Includes:** Node.js, GitHub CLI, Claude Code
- **Agents:** claude, codex, gemini, copilot, qwen, cursor, amp, deepseek

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Container not starting | `docker info` to verify Docker running |
| Auth errors | Check `ANTHROPIC_API_KEY` is set |
| Port conflicts | `lsof -i :3000` to find conflicts |
