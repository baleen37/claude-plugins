FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    jq \
    bash \
    tmux \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x from NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Verify Node.js installation
RUN node --version && npm --version

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Verify Claude Code installation
RUN claude --version

# Create workspace directory
WORKDIR /workspace

# Create non-root user for security
RUN useradd -m -s /bin/bash claude && \
    chown -R claude:claude /workspace

# Switch to non-root user
USER claude

# Verify Claude Code works as non-root
RUN claude --help
