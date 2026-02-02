import fs from 'fs/promises';
import path from 'path';
import { RalphLoopState, RalphLoopFile } from '../../types';

const STATE_DIR = path.join(process.env.HOME || '', '.claude', 'ralph-loop');
const STATE_FILE = (sessionId: string) => path.join(STATE_DIR, `ralph-loop-${sessionId}.local.md`);

// Session ID validation (alphanumeric, underscore, hyphen only)
export function isValidSessionId(sessionId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(sessionId);
}

// Parse YAML frontmatter from markdown content
export function parseFrontmatter(content: string): string {
  const lines = content.split('\n');
  let inFrontmatter = false;
  const frontmatterLines: string[] = [];

  for (const line of lines) {
    if (line === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true;
        continue;
      } else {
        // Second --- marks end of frontmatter
        break;
      }
    }
    if (inFrontmatter) {
      frontmatterLines.push(line);
    }
  }

  return frontmatterLines.join('\n');
}

// Extract prompt text (everything after frontmatter)
export function extractPrompt(content: string): string {
  const lines = content.split('\n');
  let inFrontmatter = false;
  let frontmatterCount = 0;
  const promptLines: string[] = [];

  for (const line of lines) {
    if (line === '---') {
      frontmatterCount++;
      if (frontmatterCount === 1) {
        inFrontmatter = true;
        continue;
      } else if (frontmatterCount === 2) {
        inFrontmatter = false;
        continue;
      }
    }
    if (!inFrontmatter) {
      promptLines.push(line);
    }
  }

  return promptLines.join('\n').trim();
}

// Parse iteration from frontmatter
export function getIteration(frontmatter: string): number {
  const match = frontmatter.match(/^iteration:\s*(\d+)/m);
  return match ? parseInt(match[1], 10) : 0;
}

// Parse max_iterations from frontmatter
export function getMaxIterations(frontmatter: string): number {
  const match = frontmatter.match(/^max_iterations:\s*(\d+)/m);
  return match ? parseInt(match[1], 10) : 0;
}

// Parse completion_promise from frontmatter
export function getCompletionPromise(frontmatter: string): string | null {
  const match = frontmatter.match(/^completion_promise:\s*(.+)$/m);
  if (!match) return null;

  const value = match[1].trim();
  // Remove quotes if present
  const unquoted = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  // Return null if it's literally "null"
  return unquoted === 'null' ? null : unquoted;
}

// Parse frontmatter into structured state object
export function parseStateFile(content: string): RalphLoopState {
  const frontmatter = parseFrontmatter(content);
  return {
    iteration: getIteration(frontmatter),
    max_iterations: getMaxIterations(frontmatter),
    completion_promise: getCompletionPromise(frontmatter),
    session_id: extractSessionId(frontmatter),
  };
}

// Extract session_id from frontmatter
function extractSessionId(frontmatter: string): string {
  const match = frontmatter.match(/^session_id:\s*(.+)$/m);
  return match ? match[1].trim() : '';
}

// Parse complete Ralph Loop file (frontmatter + prompt)
export function parseRalphLoopFile(content: string): RalphLoopFile {
  return {
    frontmatter: parseStateFile(content),
    prompt: extractPrompt(content),
  };
}

// Read Ralph Loop state file
export async function readStateFile(sessionId: string): Promise<RalphLoopFile | null> {
  if (!isValidSessionId(sessionId)) {
    throw new Error(`Invalid session_id: ${sessionId}`);
  }

  const filepath = STATE_FILE(sessionId);
  try {
    const content = await fs.readFile(filepath, 'utf-8');
    return parseRalphLoopFile(content);
  } catch {
    return null;
  }
}

// Check if Ralph Loop is active for session
export async function isRalphLoopActive(sessionId: string): Promise<boolean> {
  const filepath = STATE_FILE(sessionId);
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

// Delete Ralph Loop state file
export async function deleteStateFile(sessionId: string): Promise<void> {
  if (!isValidSessionId(sessionId)) {
    throw new Error(`Invalid session_id: ${sessionId}`);
  }

  const filepath = STATE_FILE(sessionId);
  await fs.unlink(filepath);
}

// Update iteration in state file
export async function updateIteration(sessionId: string, newIteration: number): Promise<void> {
  if (!isValidSessionId(sessionId)) {
    throw new Error(`Invalid session_id: ${sessionId}`);
  }

  const filepath = STATE_FILE(sessionId);
  const content = await fs.readFile(filepath, 'utf-8');

  // Replace iteration line in frontmatter
  const updatedContent = content.replace(
    /^iteration:\s*\d+$/m,
    `iteration: ${newIteration}`
  );

  await fs.writeFile(filepath, updatedContent, 'utf-8');
}

// Ensure state directory exists
export async function ensureStateDir(): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
}

// Get state file path for a session
export function getStateFilePath(sessionId: string): string {
  if (!isValidSessionId(sessionId)) {
    throw new Error(`Invalid session_id: ${sessionId}`);
  }
  return STATE_FILE(sessionId);
}
