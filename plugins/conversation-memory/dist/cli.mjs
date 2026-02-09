#!/usr/bin/env node

// src/cli/index-cli.ts
var command = process.argv[2];
if (!command || command === "--help" || command === "-h") {
  console.log(`
Conversation Memory CLI - V3 Architecture (observation-based semantic search)

USAGE:
  conversation-memory <command> [options]

COMMANDS:
  search              Search observations (MCP tool, not CLI)
  show                Show observation details (MCP tool, not CLI)
  stats               Show observation statistics (MCP tool, not CLI)
  read                Read conversation file (MCP tool, not CLI)

This CLI is minimal in V3. Most functionality is exposed through MCP tools.
The hooks system (SessionStart, PostToolUse, Stop) handles automatic operation.

ENVIRONMENT VARIABLES:
  CONVERSATION_MEMORY_CONFIG_DIR   Override config directory
  CONVERSATION_MEMORY_DB_PATH      Override database path

For more information, visit: https://github.com/wooto/claude-plugins
`);
  process.exit(0);
}
async function main() {
  console.error(`Unknown command: ${command}`);
  console.error("Run with --help for usage information.");
  process.exit(1);
}
main();
