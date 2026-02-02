#!/usr/bin/env npx tsx

import fs from 'fs/promises';
import path from 'path';
import {
  isValidSessionId,
  isRalphLoopActive,
  readStateFile,
  ensureStateDir,
} from './lib/state';
import type { SessionStartInput } from '../types';

async function main() {
  const input = JSON.parse(await readStdin()) as SessionStartInput;

  // Validate session_id exists
  if (!input.session_id || input.session_id === 'null') {
    process.exit(0);
  }

  // Validate session_id format
  if (!isValidSessionId(input.session_id)) {
    process.exit(0);
  }

  // Quick check: if no Ralph Loop state file exists, exit silently
  const isActive = await isRalphLoopActive(input.session_id);
  if (!isActive) {
    // No active Ralph Loop - exit silently without any output or side effects
    process.exit(0);
  }

  // At this point, STATE_FILE exists, so Ralph Loop is active
  // Proceed with normal initialization

  // Parse the state file to get loop information
  const stateFile = await readStateFile(input.session_id);
  if (!stateFile) {
    process.exit(0);
  }

  const { frontmatter } = stateFile;

  // Build status message to show Claude
  console.log(`🔄 Ralph Loop Active (iteration ${frontmatter.iteration})`);
  if (frontmatter.max_iterations !== 0) {
    console.log(`   Max iterations: ${frontmatter.max_iterations}`);
  } else {
    console.log(`   Max iterations: unlimited`);
  }
  if (frontmatter.completion_promise) {
    console.log(`   Completion promise: <promise>${frontmatter.completion_promise}</promise>`);
  }
  console.log(`   State file: ${getStateFilePath(input.session_id)}`);
  console.log('');

  // Store session_id in ENV_FILE for use in slash commands (optional, for /cancel-ralph)
  const envFile = process.env.CLAUDE_ENV_FILE;
  if (envFile) {
    try {
      await fs.appendFile(envFile, `export RALPH_SESSION_ID=${input.session_id}\n`);
    } catch (err) {
      // If we can't write to the env file, create our own
      await ensureStateDir();
      const fallbackEnvFile = path.join(
        process.env.HOME || '',
        '.claude',
        'ralph-loop',
        'session-env.sh'
      );
      await fs.appendFile(fallbackEnvFile, `export RALPH_SESSION_ID=${input.session_id}\n`);
    }
  } else {
    // No env file provided, create our own
    await ensureStateDir();
    const fallbackEnvFile = path.join(
      process.env.HOME || '',
      '.claude',
      'ralph-loop',
      'session-env.sh'
    );
    await fs.appendFile(fallbackEnvFile, `export RALPH_SESSION_ID=${input.session_id}\n`);
  }

  process.exit(0);
}

function getStateFilePath(sessionId: string): string {
  return path.join(
    process.env.HOME || '',
    '.claude',
    'ralph-loop',
    `ralph-loop-${sessionId}.local.md`
  );
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
