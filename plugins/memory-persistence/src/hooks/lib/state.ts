import fs from 'fs/promises';
import path from 'path';
import { TranscriptMessage } from '../../types';

// Session ID validation (alphanumeric, underscore, hyphen only)
export function isValidSessionId(sessionId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(sessionId);
}

// Get sessions directory (with environment variable override for testing)
export function getSessionsDir(): string {
  return process.env.MEMORY_PERSISTENCE_SESSIONS_DIR ||
    path.join(process.env.HOME || '', '.claude', 'sessions');
}

// Extract project folder from transcript_path
// Pattern: .claude/projects/{folder-name}/...
// Returns: project folder name (e.g., "-Users-test-dev-project-a") or empty string
export function extractProjectFolderFromTranscript(transcriptPath: string): string {
  if (!transcriptPath || transcriptPath === 'null') {
    return '';
  }

  const match = transcriptPath.match(/\.claude\/projects\/([^/]+)/);
  return match ? match[1] : '';
}

// Get project-specific sessions directory
// Priority order:
//   1. Environment variable (MEMORY_PERSISTENCE_SESSIONS_DIR)
//   2. Project-specific directory (~/.claude/projects/{project-folder})
//   3. Legacy fallback (~/.claude/sessions)
export function getSessionsDirForProject(transcriptPath?: string): string {
  // Priority 1: Environment variable (for testing)
  if (process.env.MEMORY_PERSISTENCE_SESSIONS_DIR) {
    return process.env.MEMORY_PERSISTENCE_SESSIONS_DIR;
  }

  // Priority 2: Project-specific directory
  if (transcriptPath) {
    const projectFolder = extractProjectFolderFromTranscript(transcriptPath);
    if (projectFolder) {
      return path.join(process.env.HOME || '', '.claude', 'projects', projectFolder);
    }
  }

  // Priority 3: Legacy fallback
  return path.join(process.env.HOME || '', '.claude', 'sessions');
}

// Ensure directory exists
export async function ensureDirectoryExists(dir: string): Promise<void> {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Save session file
export async function saveSessionFile(
  sessionId: string,
  content: string,
  transcriptPath?: string
): Promise<string | null> {
  const sessionsDir = getSessionsDirForProject(transcriptPath);

  try {
    await ensureDirectoryExists(sessionsDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `session-${sessionId}-${timestamp}.md`;
    const sessionFile = path.join(sessionsDir, filename);

    await fs.writeFile(sessionFile, content, 'utf-8');
    return sessionFile;
  } catch (error) {
    console.error(`Error: Could not write session file: ${error}`);
    return null;
  }
}

// Find recent session files
export async function findRecentSessions(
  count: number = 5,
  transcriptPath?: string
): Promise<string[]> {
  const sessionsDir = getSessionsDirForProject(transcriptPath);

  try {
    await fs.access(sessionsDir);
  } catch {
    return [];
  }

  try {
    const files = await fs.readdir(sessionsDir);
    const sessionFiles = files
      .filter(f => f.startsWith('session-') && f.endsWith('.md'))
      .map(f => path.join(sessionsDir, f));

    // Sort by modification time, newest first
    const stats = await Promise.all(
      sessionFiles.map(async f => ({
        path: f,
        mtime: (await fs.stat(f)).mtime,
      }))
    );

    stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return stats.slice(0, count).map(s => s.path);
  } catch {
    return [];
  }
}

// Extract assistant message from transcript
export async function extractAssistantMessageFromTranscript(
  transcriptPath: string
): Promise<string | null> {
  try {
    await fs.access(transcriptPath);
  } catch {
    console.error(`Error: Transcript file not found: ${transcriptPath}`);
    return null;
  }

  try {
    const content = await fs.readFile(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');

    // Find last assistant message
    let lastAssistantLine: string | null = null;
    for (const line of lines) {
      if (line.includes('"role"') && line.includes('"assistant"')) {
        lastAssistantLine = line;
      }
    }

    if (!lastAssistantLine) {
      console.error('Warning: No assistant messages found in transcript');
      return null;
    }

    // Parse JSON and extract text content
    const message = JSON.parse(lastAssistantLine) as TranscriptMessage;

    if (message.message?.content) {
      return message.message.content
        .filter(item => item.type === 'text')
        .map(item => item.text || '')
        .join('\n');
    }

    console.error('Warning: Failed to extract assistant message');
    return null;
  } catch (error) {
    console.error(`Warning: Failed to parse transcript: ${error}`);
    return null;
  }
}
