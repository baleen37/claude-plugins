# lsp-bash

Bash Language Server integration for Claude Code.

## Description

Provides Bash language server support for shell script editing in Claude Code,
enabling features like syntax checking, completion, and diagnostics.

## Installation

1. Install the Bash Language Server:

   ```bash
   npm install -g bash-language-server
   ```

2. Add this plugin to your Claude Code configuration.

## Configuration

The Bash Language Server will be automatically configured for `.sh`, `.bash`,
and `.zsh` files.

## Hook

- **SessionStart**: Automatically configures the Bash LSP on session start.
