/**
 * PostToolUse Hook - Store compressed tool events in pending_events table.
 *
 * This hook is triggered after every tool use and:
 * 1. Gets compressed tool data using compress.ts
 * 2. Skips tools that return null (low value tools)
 * 3. Stores in pending_events table with session_id, project, tool_name, compressed, timestamp
 * 4. Runs async (non-blocking)
 *
 * This is part of the v3 redesign that removes the observer daemon in favor
 * of simple hooks that queue events for batch processing later.
 */

import Database from 'better-sqlite3';
import { compressToolData } from '../core/compress.js';
import { insertPendingEventV3, type PendingEventV3 } from '../core/db.v3.js';
import { getCurrentSessionId } from '../core/observer.js';

/**
 * Handle PostToolUse hook - compress and store tool events.
 *
 * @param db - Database instance (optional, for testing)
 * @param toolName - Name of the tool that was called
 * @param toolData - Result/output data from the tool call
 * @param project - Project name (optional, falls back to CWD-based)
 * @returns Promise that resolves when the event is stored
 */
export async function handlePostToolUse(
  db: Database.Database,
  toolName: string,
  toolData: unknown,
  project?: string
): Promise<void> {
  try {
    // Step 1: Get compressed tool data
    const compressed = compressToolData(toolName, toolData);

    // Step 2: Skip if compression returned null (low value tool)
    if (compressed === null) {
      return;
    }

    // Step 3: Prepare event data
    const now = Date.now();
    const sessionId = getCurrentSessionId();

    const event: PendingEventV3 = {
      sessionId,
      project: project || process.cwd().split('/').pop() || 'unknown',
      toolName,
      compressed,
      timestamp: now,
      createdAt: now,
    };

    // Step 4: Store in pending_events table
    insertPendingEventV3(db, event);
  } catch (error) {
    // Fail silently to not interrupt Claude Code
    // Log to stderr for debugging
    console.error('[conversation-memory] PostToolUse error:', error);
  }
}

/**
 * CLI entry point for PostToolUse hook.
 *
 * This is called from hooks.json and reads tool data from stdin.
 * The hook is configured as async (non-blocking) to not slow down Claude Code.
 *
 * Expected stdin format (JSON):
 * {
 *   "tool": "ToolName",
 *   "input": {...},
 *   "response": {...}
 * }
 */
export async function main(): Promise<void> {
  try {
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
    const toolResponse = data.response;

    // Initialize database
    // Note: Using the v3 database schema
    const { initDatabaseV3 } = await import('../core/db.v3.js');
    const db = initDatabaseV3();

    // Handle the tool use event
    await handlePostToolUse(db, toolName, toolResponse);

    // Close database
    db.close();

    process.exit(0);
  } catch (error) {
    // Fail silently to not interrupt Claude Code
    console.error('[conversation-memory] PostToolUse CLI error:', error);
    process.exit(0);
  }
}

// Run main if this is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
