#!/usr/bin/env npx tsx

import fs from 'fs/promises';
import readline from 'readline';
import {
  isValidSessionId,
  isRalphLoopActive,
  readStateFile,
  deleteStateFile,
  updateIteration,
  getStateFilePath,
} from './lib/state';
import type { StopInput, StopDecision, TranscriptMessage } from '../types';

async function main() {
  const input = JSON.parse(await readStdin()) as StopInput;

  // Validate session_id format
  if (!isValidSessionId(input.session_id)) {
    console.error(
      'Warning: Ralph loop: Invalid session_id format (must be alphanumeric, dash, or underscore)'
    );
    process.exit(0);
  }

  // Check if ralph-loop is active for this session
  const isActive = await isRalphLoopActive(input.session_id);
  if (!isActive) {
    // No active loop for this session - allow exit
    process.exit(0);
  }

  // Parse markdown frontmatter (YAML between ---) and extract values
  const stateFile = await readStateFile(input.session_id);
  if (!stateFile) {
    process.exit(0);
  }

  const { frontmatter, prompt } = stateFile;

  // Validate numeric fields before arithmetic operations
  if (!Number.isInteger(frontmatter.iteration) || frontmatter.iteration < 0) {
    console.error('⚠️ Ralph loop: State file corrupted');
    console.error(` File: ${getStateFilePath(input.session_id)}`);
    console.error(` Problem: 'iteration' field is not a valid number (got: '${frontmatter.iteration}')`);
    console.error('');
    console.error(' This usually means the state file was manually edited or corrupted.');
    console.error(" Ralph loop is stopping. Run /ralph-loop again to start fresh.");
    await deleteStateFile(input.session_id);
    process.exit(0);
  }

  if (!Number.isInteger(frontmatter.max_iterations) || frontmatter.max_iterations < 0) {
    console.error('⚠️ Ralph loop: State file corrupted');
    console.error(` File: ${getStateFilePath(input.session_id)}`);
    console.error(
      ` Problem: 'max_iterations' field is not a valid number (got: '${frontmatter.max_iterations}')`
    );
    console.error('');
    console.error(' This usually means the state file was manually edited or corrupted.');
    console.error(" Ralph loop is stopping. Run /ralph-loop again to start fresh.");
    await deleteStateFile(input.session_id);
    process.exit(0);
  }

  // Check if max iterations reached
  if (frontmatter.max_iterations > 0 && frontmatter.iteration >= frontmatter.max_iterations) {
    console.log(`🛑 Ralph loop: Max iterations (${frontmatter.max_iterations}) reached.`);
    await deleteStateFile(input.session_id);
    process.exit(0);
  }

  // Get transcript path from hook input
  const transcriptPath = input.transcript_path;

  try {
    await fs.access(transcriptPath);
  } catch {
    console.error('⚠️ Ralph loop: Transcript file not found');
    console.error(` Expected: ${transcriptPath}`);
    console.error(' This is unusual and may indicate a Claude Code internal issue.');
    console.error(' Ralph loop is stopping.');
    await deleteStateFile(input.session_id);
    process.exit(0);
  }

  // Read last assistant message from transcript (JSONL format - one JSON per line)
  const lastAssistantMessage = await getLastAssistantMessage(transcriptPath);
  if (!lastAssistantMessage) {
    console.error('⚠️ Ralph loop: No assistant messages found in transcript');
    console.error(` Transcript: ${transcriptPath}`);
    console.error(' This is unusual and may indicate a transcript format issue');
    console.error(' Ralph loop is stopping.');
    await deleteStateFile(input.session_id);
    process.exit(0);
  }

  // Extract text content from assistant message
  const lastOutput = extractTextContent(lastAssistantMessage);
  if (!lastOutput) {
    console.error('⚠️ Ralph loop: Assistant message contained no text content');
    console.error(' Ralph loop is stopping.');
    await deleteStateFile(input.session_id);
    process.exit(0);
  }

  // Check for completion promise (only if set)
  if (frontmatter.completion_promise) {
    const promiseText = extractPromiseText(lastOutput);
    if (promiseText === frontmatter.completion_promise) {
      console.log(`✅ Ralph loop: Detected <promise>${frontmatter.completion_promise}</promise>`);
      await deleteStateFile(input.session_id);
      process.exit(0);
    }
  }

  // Not complete - continue loop with SAME PROMPT
  const nextIteration = frontmatter.iteration + 1;

  // Validate prompt text exists
  if (!prompt) {
    console.error('⚠️ Ralph loop: State file corrupted or incomplete');
    console.error(` File: ${getStateFilePath(input.session_id)}`);
    console.error(' Problem: No prompt text found');
    console.error('');
    console.error(' This usually means:');
    console.error(' • State file was manually edited');
    console.error(' • File was corrupted during writing');
    console.error('');
    console.error(" Ralph loop is stopping. Run /ralph-loop again to start fresh.");
    await deleteStateFile(input.session_id);
    process.exit(0);
  }

  // Update iteration in frontmatter
  await updateIteration(input.session_id, nextIteration);

  // Build system message with iteration count and completion promise info
  let systemMsg: string;
  if (frontmatter.completion_promise) {
    systemMsg = `🔄 Ralph iteration ${nextIteration} | To stop: output <promise>${frontmatter.completion_promise}</promise> (ONLY when statement is TRUE - do not lie to exit!)`;
  } else {
    systemMsg = `🔄 Ralph iteration ${nextIteration} | No completion promise set - loop runs infinitely`;
  }

  // Output JSON to block the stop and feed prompt back
  const decision: StopDecision = {
    decision: 'block',
    reason: prompt,
    systemMessage: systemMsg,
  };

  console.log(JSON.stringify(decision));

  // Exit 0 for successful hook execution
  process.exit(0);
}

// Get last assistant message from transcript file
async function getLastAssistantMessage(transcriptPath: string): Promise<TranscriptMessage | null> {
  const fileStream = await fs.open(transcriptPath, 'r');
  const rl = readline.createInterface({
    input: fileStream.createReadStream(),
    crlfDelay: Infinity,
  });

  let lastMessage: TranscriptMessage | null = null;

  for await (const line of rl) {
    try {
      const message = JSON.parse(line) as TranscriptMessage;
      if (message.role === 'assistant') {
        lastMessage = message;
      }
    } catch {
      // Skip invalid JSON lines
      continue;
    }
  }

  await fileStream.close();
  return lastMessage;
}

// Extract text content from assistant message
function extractTextContent(message: TranscriptMessage): string {
  if (!message.message?.content) {
    return '';
  }

  return message.message.content
    .filter((item) => item.type === 'text' && item.text)
    .map((item) => item.text!)
    .join('\n');
}

// Extract promise text from <promise> tags
function extractPromiseText(content: string): string | null {
  // Match <promise>...</promise> tags (non-greedy)
  const match = content.match(/<promise>(.*?)<\/promise>/s);
  if (!match) return null;

  // Extract and normalize whitespace
  return match[1].trim().replace(/\s+/g, ' ');
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
