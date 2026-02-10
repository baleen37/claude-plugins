import { openDatabase } from '../core/db.v3.js';
import { handlePostToolUse } from '../hooks/post-tool-use.js';
import { handleStop } from '../hooks/stop.js';
import { loadConfig, createProvider } from '../core/llm/config.js';

const command = process.argv[2];

// Show help if no command or --help
if (!command || command === '--help' || command === '-h') {
  console.log(`
Conversation Memory CLI - V3 Architecture (observation-based semantic search)

USAGE:
  conversation-memory <command> [options]

COMMANDS:
  observe              Capture tool event (for PostToolUse hook)
  observe --summarize  Extract observations from pending events (for Stop hook)

OPTIONS FOR observe:
  --tool <name>        Tool name that was called
  --data <json>        Tool result data as JSON string

ENVIRONMENT VARIABLES (required for hooks):
  CLAUDE_SESSION_ID    Current session ID
  CLAUDE_PROJECT       Current project name

ENVIRONMENT VARIABLES:
  CONVERSATION_MEMORY_CONFIG_DIR   Override config directory
  CONVERSATION_MEMORY_DB_PATH      Override database path

For more information, visit: https://github.com/wooto/claude-plugins
`);
  process.exit(0);
}

async function main() {
  if (command === 'observe') {
    const summarizeIndex = process.argv.indexOf('--summarize');
    const isSummarize = summarizeIndex !== -1;

    // Get environment variables
    const sessionId = process.env.CLAUDE_SESSION_ID || process.env.SESSION_ID || 'unknown';
    const project = process.env.CLAUDE_PROJECT || process.env.PROJECT || 'unknown';

    // Initialize database
    const db = openDatabase();

    try {
      if (isSummarize) {
        // Stop hook: Extract observations from pending events
        const config = loadConfig();
        if (!config) {
          console.error('Error: No LLM config found. Please create ~/.config/conversation-memory/config.json with apiKey field.');
          process.exit(1);
        }
        const provider = createProvider(config);
        await handleStop(db, {
          provider,
          sessionId,
          project,
        });
      } else {
        // PostToolUse hook: Store tool event
        const toolIndex = process.argv.indexOf('--tool');
        const dataIndex = process.argv.indexOf('--data');

        if (toolIndex === -1 || dataIndex === -1) {
          console.error('Error: --tool and --data are required for observe command');
          process.exit(1);
        }

        const toolName = process.argv[toolIndex + 1];
        const dataJson = process.argv[dataIndex + 1];

        if (!toolName || dataJson === undefined) {
          console.error('Error: --tool and --data require values');
          process.exit(1);
        }

        let toolData: unknown;
        try {
          toolData = JSON.parse(dataJson);
        } catch {
          // If not valid JSON, use as string
          toolData = dataJson;
        }

        handlePostToolUse(db, sessionId, project, toolName, toolData);
      }
    } finally {
      db.close();
    }
    process.exit(0);
  }

  console.error(`Unknown command: ${command}`);
  console.error('Run with --help for usage information.');
  process.exit(1);
}

main();
