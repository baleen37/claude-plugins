/**
 * PostToolUse Hook - Store compressed tool events in pending_events table.
 *
 * This hook is triggered after every tool use and:
 * 1. Gets compressed tool data using compress.ts
 * 2. Skips tools that return null (low value tools)
 * 3. Stores in pending_events table with session_id, project, tool_name, compressed, timestamp
 * 4. Runs async (non-blocking)
 */

import Database from 'better-sqlite3';
import { compressToolData } from '../core/compress.js';
import { insertPendingEventV3, type PendingEventV3 } from '../core/db.v3.js';

/**
 * Handle PostToolUse hook - compress and store tool events.
 *
 * @param db - Database instance
 * @param sessionId - Session ID from environment
 * @param project - Project name
 * @param toolName - Name of the tool that was called
 * @param toolData - Result/output data from the tool call
 */
export function handlePostToolUse(
  db: Database.Database,
  sessionId: string,
  project: string,
  toolName: string,
  toolData: unknown
): void {
  // Step 1: Get compressed tool data
  const compressed = compressToolData(toolName, toolData);

  // Step 2: Skip if compression returned null (low value tool)
  if (compressed === null) {
    return;
  }

  // Step 3: Store in pending_events table
  const now = Date.now();
  const event: PendingEventV3 = {
    sessionId,
    project,
    toolName,
    compressed,
    timestamp: now,
    createdAt: now,
  };

  insertPendingEventV3(db, event);
}
