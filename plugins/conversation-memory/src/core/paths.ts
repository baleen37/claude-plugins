import os from 'os';
import path from 'path';
import fs from 'fs';

/**
 * Ensure a directory exists, creating it if necessary
 */
function ensureDir(dir: string): string {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get the conversation memory directory
 *
 * Precedence:
 * 1. CONVERSATION_MEMORY_CONFIG_DIR env var (if set, for testing)
 * 2. ~/.config/conversation-memory/ (default)
 */
export function getSuperpowersDir(): string {
  let dir: string;

  if (process.env.CONVERSATION_MEMORY_CONFIG_DIR) {
    dir = process.env.CONVERSATION_MEMORY_CONFIG_DIR;
  } else {
    dir = path.join(os.homedir(), '.config', 'conversation-memory');
  }

  return ensureDir(dir);
}

/**
 * Get conversation archive directory
 */
export function getArchiveDir(): string {
  // Allow test override
  if (process.env.TEST_ARCHIVE_DIR) {
    return ensureDir(process.env.TEST_ARCHIVE_DIR);
  }

  return ensureDir(path.join(getSuperpowersDir(), 'conversation-archive'));
}

/**
 * Get conversation index directory
 */
export function getIndexDir(): string {
  return ensureDir(path.join(getSuperpowersDir(), 'conversation-index'));
}

/**
 * Get database path
 */
export function getDbPath(): string {
  // Allow test override with direct DB path
  if (process.env.CONVERSATION_MEMORY_DB_PATH || process.env.TEST_DB_PATH) {
    return process.env.CONVERSATION_MEMORY_DB_PATH || process.env.TEST_DB_PATH!;
  }

  return path.join(getIndexDir(), 'conversations.db');
}

/**
 * Get exclude config path
 */
export function getExcludeConfigPath(): string {
  return path.join(getIndexDir(), 'exclude.txt');
}

/**
 * Get list of projects to exclude from indexing
 * Configurable via env var or config file
 */
export function getExcludedProjects(): string[] {
  // Check env variable first
  if (process.env.CONVERSATION_SEARCH_EXCLUDE_PROJECTS) {
    return process.env.CONVERSATION_SEARCH_EXCLUDE_PROJECTS.split(',').map(p => p.trim());
  }

  // Check for config file
  const configPath = getExcludeConfigPath();
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8');
    return content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  }

  // Default: no exclusions
  return [];
}

/**
 * Get log directory
 */
export function getLogDir(): string {
  return ensureDir(path.join(getSuperpowersDir(), 'logs'));
}

/**
 * Get log file path for current date
 */
export function getLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(getLogDir(), `${date}.log`);
}

/**
 * Get observer PID file path
 */
export function getObserverPidPath(): string {
  return path.join(getSuperpowersDir(), 'observer.pid');
}
