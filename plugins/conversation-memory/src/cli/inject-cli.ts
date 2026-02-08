/**
 * Inject CLI - Handle SessionStart hook for context injection.
 *
 * This CLI is called from SessionStart hook and must complete quickly (~100ms).
 * No LLM calls are made in this CLI - it reads from the database.
 */

import { getInjectContext } from '../core/inject.js';
import { getCurrentProject } from '../core/observer.js';

async function main() {
  try {
    const project = getCurrentProject();
    const context = getInjectContext(project);

    // Output to stdout for injection into Claude's context
    console.log(context);
  } catch (error) {
    // Fail silently to not interrupt Claude Code startup
    // Only log to stderr
    console.error('[conversation-memory] Inject error:', error);
    process.exit(0);
  }
}

main();
