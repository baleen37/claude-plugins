#!/usr/bin/env node
/**
 * Inject CLI - Handle SessionStart hook for conversation-memory.
 *
 * This script is called by the hooks system and:
 * 1. Reads session data from stdin (JSON)
 * 2. Queries recent observations for the project
 * 3. Formats as markdown with token budget
 * 4. Returns formatted markdown via stdout for injection
 */

import { openDatabase } from '../core/db.v3.js';
import { handleSessionStart } from '../hooks/session-start.js';
import type { SessionStartConfig } from '../hooks/session-start.js';

interface SessionStartInput {
  session_id: string;
  transcript_path: string;
  project?: string;
}

/**
 * Read stdin as JSON.
 */
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

/**
 * Get project name from transcript path or environment.
 */
function getProject(input: SessionStartInput): string {
  if (input.project) {
    return input.project;
  }

  // Extract from transcript path: /path/to/.claude/projects/<project>/sessions/<session-id>/transcript.jsonl
  const match = input.transcript_path.match(/\/projects\/([^\/]+)\//);
  if (match && match[1]) {
    return match[1];
  }

  // Fallback to environment or default
  return process.env.CLAUDE_PROJECT || 'default';
}

/**
 * Get hook configuration from environment or use defaults.
 */
function getConfig(): SessionStartConfig {
  return {
    maxObservations: parseInt(process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS || '10', 10),
    maxTokens: parseInt(process.env.CONVERSATION_MEMORY_MAX_TOKENS || '1000', 10),
    recencyDays: parseInt(process.env.CONVERSATION_MEMORY_RECENCY_DAYS || '7', 10),
    projectOnly: process.env.CONVERSATION_MEMORY_PROJECT_ONLY === 'true',
  };
}

async function main() {
  try {
    // Read input from stdin (may be empty for SessionStart)
    const stdinData = await readStdin();

    // Parse input or use defaults if stdin is empty
    let input: SessionStartInput;
    if (stdinData.trim()) {
      input = JSON.parse(stdinData) as SessionStartInput;
    } else {
      // Default input when no stdin data provided
      input = {
        session_id: process.env.CLAUDE_SESSION_ID || 'unknown',
        transcript_path: '',
      };
    }

    // Get project and config
    const project = getProject(input);
    const config = getConfig();

    // Open existing database (don't wipe)
    const db = openDatabase();

    try {
      // Handle session start hook
      const result = await handleSessionStart(db, project, config);

      // Output markdown to stdout for injection
      if (result.markdown) {
        console.log(result.markdown);
      }

      // Debug info to stderr (optional, can be removed)
      // console.error(`[conversation-memory] Injected ${result.includedCount} observations (${result.tokenCount} tokens)`);
    } finally {
      db.close();
    }
  } catch (error) {
    console.error(`[conversation-memory] Error in inject: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
