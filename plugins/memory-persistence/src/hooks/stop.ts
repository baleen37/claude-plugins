#!/usr/bin/env -S node --import=tsx/esm

import { isValidSessionId, extractAssistantMessageFromTranscript, saveSessionFile } from './lib/state';

interface StopInput {
  session_id: string;
  transcript_path: string;
}

async function main() {
  const input = JSON.parse(await readStdin()) as StopInput;

  const sessionId = input.session_id;
  const transcriptPath = input.transcript_path;

  // Validate session_id exists
  if (!sessionId || sessionId === 'null') {
    console.error('Warning: Memory persistence: No session_id found in Stop hook');
    process.exit(0); // Always exit 0 to avoid blocking session exit
  }

  // Validate session_id format
  if (!isValidSessionId(sessionId)) {
    console.error(`Warning: Memory persistence: Invalid session_id format: '${sessionId}'`);
    process.exit(0); // Always exit 0 to avoid blocking session exit
  }

  // Check if transcript file exists
  try {
    const fs = await import('fs/promises');
    await fs.access(transcriptPath);
  } catch {
    console.error(`Warning: Memory persistence: Transcript file not found: ${transcriptPath}`);
    process.exit(0); // Always exit 0 to avoid blocking session exit
  }

  // Extract last assistant message from transcript
  const conversation = await extractAssistantMessageFromTranscript(transcriptPath);

  if (!conversation) {
    console.error('Warning: Memory persistence: No conversation content extracted');
    process.exit(0); // Always exit 0 to avoid blocking session exit
  }

  // Build session content
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const sessionContent = `# Session: ${sessionId}
# Date: ${timestamp}

## Last Assistant Message

${conversation}

## Session Metadata

- Session ID: ${sessionId}
- End Time: ${timestamp}
- Transcript: ${transcriptPath}
- Saved by: memory-persistence plugin
`;

  // Save session file with transcript_path for project-specific directory
  const sessionFile = await saveSessionFile(sessionId, sessionContent, transcriptPath);

  if (!sessionFile) {
    console.error('Warning: Memory persistence: Failed to save session');
  }

  // CRITICAL: Exit 0 WITHOUT any output on success
  // - No stdout (that would block session exit like ralph-loop does)
  // - No stderr on success (following ralph-loop's TRUE silent pattern)
  // - Stderr is only for WARNING/ERROR conditions above
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
