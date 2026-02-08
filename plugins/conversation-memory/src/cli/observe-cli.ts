/**
 * Observe CLI - Handle PostToolUse and Stop hooks for the observer system.
 *
 * This CLI is called from hooks and must complete in <5ms for PostToolUse.
 * No LLM calls are made in this CLI - those are handled by the observer process.
 */

import { initDatabase, insertPendingEvent } from '../core/db.js';
import { getCurrentSessionId, getCurrentProject } from '../core/observer.js';
import { isLowValueTool, generateId, configureSkipTools } from '../core/observation-prompt.js';
import { loadConfig } from '../core/llm/config.js';

const args = process.argv.slice(2);
const isSummarize = args.includes('--summarize');

/**
 * Handle PostToolUse hook - queue tool use events for processing.
 * Must complete in <5ms, so no LLM calls here.
 */
async function handlePostToolUse(): Promise<void> {
  const startTime = Date.now();

  try {
    // Load config and configure skipTools (fast operation - file read)
    const config = loadConfig();
    if (config?.skipTools) {
      configureSkipTools(config.skipTools);
    }

    // Read tool use data from stdin
    let inputData = '';
    for await (const chunk of process.stdin) {
      inputData += chunk;
    }

    if (!inputData) {
      // No input, exit silently
      process.exit(0);
    }

    const data = JSON.parse(inputData);
    const toolName = data.tool;

    // Skip low-value tools
    if (isLowValueTool(toolName)) {
      process.exit(0);
    }

    // Initialize database (fast operation)
    const db = initDatabase();

    // Insert pending event
    const event = {
      id: generateId(),
      sessionId: getCurrentSessionId(),
      eventType: 'tool_use' as const,
      toolName,
      toolInput: data.input,
      toolResponse: data.response,
      cwd: process.cwd(),
      project: getCurrentProject(),
      timestamp: Date.now(),
      processed: false,
      createdAt: Date.now()
    };

    insertPendingEvent(db, event);
    db.close();

    const elapsed = Date.now() - startTime;
    if (elapsed > 5) {
      console.error(`[conversation-memory] Warning: PostToolUse took ${elapsed}ms (target: <5ms)`);
    }

    process.exit(0);
  } catch (error) {
    // Fail silently to not interrupt Claude Code
    console.error('[conversation-memory] PostToolUse error:', error);
    process.exit(0);
  }
}

/**
 * Handle Stop hook - request session summary.
 */
async function handleStop(): Promise<void> {
  try {
    const db = initDatabase();

    const event = {
      id: generateId(),
      sessionId: getCurrentSessionId(),
      eventType: 'summarize' as const,
      cwd: process.cwd(),
      project: getCurrentProject(),
      timestamp: Date.now(),
      processed: false,
      createdAt: Date.now()
    };

    insertPendingEvent(db, event);
    db.close();

    process.exit(0);
  } catch (error) {
    console.error('[conversation-memory] Stop error:', error);
    process.exit(0);
  }
}

async function main() {
  if (isSummarize) {
    await handleStop();
  } else {
    await handlePostToolUse();
  }
}

main();
