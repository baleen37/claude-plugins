FROM node:20-slim

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies, Claude Code CLI, and verify in one layer
RUN apt-get update && apt-get install -y \
    curl git jq bash tmux ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g @anthropic-ai/claude-code \
    && npm cache clean --force \
    && claude --version

# Create workspace directory
WORKDIR /workspace

# Create non-root user for security
RUN useradd -m -s /bin/bash claude && \
    chown -R claude:claude /workspace

# Switch to non-root user
USER claude

# Verify Claude Code works as non-root
RUN claude --help
