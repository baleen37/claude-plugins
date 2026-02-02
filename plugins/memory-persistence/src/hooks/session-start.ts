#!/usr/bin/env -S node --import=tsx/esm

import fs from 'fs/promises';
import { isValidSessionId, findRecentSessions } from './lib/state';

interface SessionStartInput {
  session_id: string;
  transcript_path: string;
}

async function main() {
  const input = JSON.parse(await readStdin()) as SessionStartInput;

  const sessionId = input.session_id;
  const transcriptPath = input.transcript_path;

  // Validate session_id exists
  if (!sessionId || sessionId === 'null') {
    process.exit(0);
  }

  // Validate session_id format
  if (!isValidSessionId(sessionId)) {
    process.exit(0);
  }

  // Find recent session files for this project
  const recentSessions = await findRecentSessions(5, transcriptPath);

  if (recentSessions.length === 0) {
    // No previous sessions found
    process.exit(0);
  }

  // Display restored context header
  // NOTE: SessionStart hook CAN write to stdout (unlike Stop hook)
  // because SessionStart output is expected and shown to the user.
  // Stop hook must be silent on success to avoid blocking session exit.
  console.log('');
  console.log('## Restored Context from Previous Sessions');
  console.log('');

  // Process each recent session
  for (const sessionFile of recentSessions) {
    try {
      await fs.access(sessionFile);
      const basename = sessionFile.split('/').pop() || sessionFile;
      console.log(`### From: ${basename}`);
      console.log('');

      // Extract and display summary (first 50 lines)
      const content = await fs.readFile(sessionFile, 'utf-8');
      const lines = content.split('\n').slice(0, 50);
      console.log(lines.join('\n'));
      console.log('');
      console.log('---');
      console.log('');
    } catch {
      // Skip files that don't exist or can't be read
    }
  }

  process.exit(0);
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
