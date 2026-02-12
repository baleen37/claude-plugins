const command = process.argv[2];

// Show help if no command or --help
if (!command || command === '--help' || command === '-h') {
  console.log(`
Conversation Memory CLI - V3 Architecture (observation-based semantic search)

USAGE:
  conversation-memory <command> [options]

COMMANDS:
  inject              Inject recent context at session start (for SessionStart hook)
  observe             Handle PostToolUse hook - compress and store tool events
  observe --summarize Handle Stop hook - extract observations from pending events

MCP TOOLS (use via Claude Code MCP, not CLI):
  search              Search observations with filters
  show                Display observation details
  stats               Show database statistics
  read                Read conversation files

HOOKS:
  The inject and observe commands are used by the hooks system.
  Most functionality is exposed through MCP tools.

ENVIRONMENT VARIABLES:
  CONVERSATION_MEMORY_CONFIG_DIR   Override config directory
  CONVERSATION_MEMORY_DB_PATH      Override database path
  CLAUDE_SESSION_ID                Session ID (set by hooks system)
  CLAUDE_PROJECT                   Project name (set by hooks system)

For more information, visit: https://github.com/wooto/claude-plugins
`);
  process.exit(0);
}

async function main() {
  switch (command) {
    case 'inject':
      await import('./inject-cli.js');
      break;
    case 'observe':
      await import('./observe-cli.js');
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run with --help for usage information.');
      process.exit(1);
  }
}

main();
