import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { rmSync } from 'fs';

// Import functions to test
import {
  getSuperpowersDir,
  getArchiveDir,
  getIndexDir,
  getDbPath,
  getExcludeConfigPath,
  getExcludedProjects,
  getLogDir,
  getLogFilePath,
} from './paths.js';

// Track original environment and temp directories
let originalEnv: NodeJS.ProcessEnv;
let tempDirs: string[] = [];

function setupTempDir(): string {
  const tempDir = path.join(os.tmpdir(), `conversation-memory-test-${Date.now()}-${Math.random()}`);
  tempDirs.push(tempDir);
  return tempDir;
}

function cleanupTempDirs() {
  for (const dir of tempDirs) {
    if (fs.existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  tempDirs = [];
}

describe('paths utilities', () => {
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear relevant environment variables for clean testing
    delete process.env.CONVERSATION_MEMORY_CONFIG_DIR;
    delete process.env.TEST_ARCHIVE_DIR;
    delete process.env.CONVERSATION_MEMORY_DB_PATH;
    delete process.env.TEST_DB_PATH;
    delete process.env.CONVERSATION_SEARCH_EXCLUDE_PROJECTS;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Clean up temp directories
    cleanupTempDirs();
  });

  describe('ensureDir behavior (via getSuperpowersDir)', () => {
    test('creates directory if it does not exist', () => {
      const tempDir = setupTempDir();
      const newDir = path.join(tempDir, 'new-directory');

      process.env.CONVERSATION_MEMORY_CONFIG_DIR = newDir;

      // Verify directory doesn't exist
      expect(fs.existsSync(newDir)).toBe(false);

      // Call function that should create the directory
      const result = getSuperpowersDir();

      // Verify directory was created
      expect(fs.existsSync(newDir)).toBe(true);
      expect(result).toBe(newDir);
    });

    test('does not error if directory already exists', () => {
      const tempDir = setupTempDir();
      const existingDir = path.join(tempDir, 'existing-directory');

      // Create directory
      fs.mkdirSync(existingDir, { recursive: true });
      expect(fs.existsSync(existingDir)).toBe(true);

      process.env.CONVERSATION_MEMORY_CONFIG_DIR = existingDir;

      // Should not throw
      const result = getSuperpowersDir();

      expect(result).toBe(existingDir);
      expect(fs.existsSync(existingDir)).toBe(true);
    });

    test('returns the directory path', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const result = getSuperpowersDir();

      expect(result).toBe(tempDir);
    });
  });

  describe('getSuperpowersDir', () => {
    test('respects CONVERSATION_MEMORY_CONFIG_DIR environment variable', () => {
      const customDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = customDir;

      const result = getSuperpowersDir();

      expect(result).toBe(customDir);
    });

    test('uses default ~/.config/conversation-memory when env var not set', () => {
      // Delete the env var to test default behavior
      delete process.env.CONVERSATION_MEMORY_CONFIG_DIR;

      const result = getSuperpowersDir();
      const expected = path.join(os.homedir(), '.config', 'conversation-memory');

      expect(result).toBe(expected);
    });

    test('creates default directory if it does not exist', () => {
      delete process.env.CONVERSATION_MEMORY_CONFIG_DIR;

      const tempDir = setupTempDir();
      // Use a temp home directory for testing
      const tempHome = path.join(tempDir, 'home');
      fs.mkdirSync(tempHome, { recursive: true });

      // We can't easily override os.homedir(), so this test documents
      // that the function creates the directory it returns
      const result = getSuperpowersDir();

      // The directory should exist after the call
      expect(fs.existsSync(result)).toBe(true);
    });
  });

  describe('getArchiveDir', () => {
    test('returns archive directory path under superpowers dir', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const result = getArchiveDir();
      const expected = path.join(tempDir, 'conversation-archive');

      expect(result).toBe(expected);
    });

    test('creates archive directory if it does not exist', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const result = getArchiveDir();

      expect(fs.existsSync(result)).toBe(true);
    });

    test('respects TEST_ARCHIVE_DIR environment variable', () => {
      const testArchiveDir = setupTempDir();
      process.env.TEST_ARCHIVE_DIR = testArchiveDir;

      const result = getArchiveDir();

      expect(result).toBe(testArchiveDir);
    });
  });

  describe('getIndexDir', () => {
    test('returns index directory path under superpowers dir', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const result = getIndexDir();
      const expected = path.join(tempDir, 'conversation-index');

      expect(result).toBe(expected);
    });

    test('creates index directory if it does not exist', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const result = getIndexDir();

      expect(fs.existsSync(result)).toBe(true);
    });
  });

  describe('getDbPath', () => {
    test('returns database file path in index directory', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const result = getDbPath();
      const expected = path.join(tempDir, 'conversation-index', 'conversations.db');

      expect(result).toBe(expected);
    });

    test('respects CONVERSATION_MEMORY_DB_PATH environment variable', () => {
      const customDbPath = setupTempDir();
      fs.mkdirSync(customDbPath, { recursive: true });
      const dbFile = path.join(customDbPath, 'custom.db');
      process.env.CONVERSATION_MEMORY_DB_PATH = dbFile;

      const result = getDbPath();

      expect(result).toBe(dbFile);
    });

    test('respects TEST_DB_PATH environment variable', () => {
      const testDbPath = setupTempDir();
      fs.mkdirSync(testDbPath, { recursive: true });
      const dbFile = path.join(testDbPath, 'test.db');
      process.env.TEST_DB_PATH = dbFile;

      const result = getDbPath();

      expect(result).toBe(dbFile);
    });

    test('CONVERSATION_MEMORY_DB_PATH takes precedence over TEST_DB_PATH', () => {
      const tempDir = setupTempDir();
      const primaryDb = path.join(tempDir, 'primary.db');
      const fallbackDb = path.join(tempDir, 'fallback.db');
      process.env.CONVERSATION_MEMORY_DB_PATH = primaryDb;
      process.env.TEST_DB_PATH = fallbackDb;

      const result = getDbPath();

      expect(result).toBe(primaryDb);
    });
  });

  describe('getExcludeConfigPath', () => {
    test('returns exclude config file path in index directory', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const result = getExcludeConfigPath();
      const expected = path.join(tempDir, 'conversation-index', 'exclude.txt');

      expect(result).toBe(expected);
    });
  });

  describe('getExcludedProjects', () => {
    test('returns empty array when no exclusions configured', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const result = getExcludedProjects();

      expect(result).toEqual([]);
    });

    test('reads and parses exclude config file', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const excludePath = path.join(tempDir, 'conversation-index', 'exclude.txt');
      const content = 'project-a\nproject-b\nproject-c';
      fs.mkdirSync(path.dirname(excludePath), { recursive: true });
      fs.writeFileSync(excludePath, content);

      const result = getExcludedProjects();

      expect(result).toEqual(['project-a', 'project-b', 'project-c']);
    });

    test('trims whitespace from project names', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const excludePath = path.join(tempDir, 'conversation-index', 'exclude.txt');
      const content = '  project-a  \nproject-b\n  project-c';
      fs.mkdirSync(path.dirname(excludePath), { recursive: true });
      fs.writeFileSync(excludePath, content);

      const result = getExcludedProjects();

      expect(result).toEqual(['project-a', 'project-b', 'project-c']);
    });

    test('filters out empty lines', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const excludePath = path.join(tempDir, 'conversation-index', 'exclude.txt');
      const content = 'project-a\n\n\nproject-b\n\nproject-c';
      fs.mkdirSync(path.dirname(excludePath), { recursive: true });
      fs.writeFileSync(excludePath, content);

      const result = getExcludedProjects();

      expect(result).toEqual(['project-a', 'project-b', 'project-c']);
    });

    test('filters out lines starting with #', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const excludePath = path.join(tempDir, 'conversation-index', 'exclude.txt');
      const content = '# This is a comment\nproject-a\n# Another comment\nproject-b';
      fs.mkdirSync(path.dirname(excludePath), { recursive: true });
      fs.writeFileSync(excludePath, content);

      const result = getExcludedProjects();

      expect(result).toEqual(['project-a', 'project-b']);
    });

    test('returns empty array if exclude file does not exist', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      // Don't create the exclude file
      const result = getExcludedProjects();

      expect(result).toEqual([]);
    });

    test('CONVERSATION_SEARCH_EXCLUDE_PROJECTS env var takes precedence', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      // Create an exclude file
      const excludePath = path.join(tempDir, 'conversation-index', 'exclude.txt');
      fs.mkdirSync(path.dirname(excludePath), { recursive: true });
      fs.writeFileSync(excludePath, 'file-project-a\nfile-project-b');

      // Set env var
      process.env.CONVERSATION_SEARCH_EXCLUDE_PROJECTS = 'env-project-a,env-project-b';

      const result = getExcludedProjects();

      // Env var should take precedence
      expect(result).toEqual(['env-project-a', 'env-project-b']);
    });

    test('parses CONVERSATION_SEARCH_EXCLUDE_PROJECTS comma-separated list', () => {
      process.env.CONVERSATION_SEARCH_EXCLUDE_PROJECTS = 'project-a,project-b,project-c';

      const result = getExcludedProjects();

      expect(result).toEqual(['project-a', 'project-b', 'project-c']);
    });

    test('trims whitespace from comma-separated env var list', () => {
      process.env.CONVERSATION_SEARCH_EXCLUDE_PROJECTS = ' project-a , project-b , project-c ';

      const result = getExcludedProjects();

      expect(result).toEqual(['project-a', 'project-b', 'project-c']);
    });
  });

  describe('getLogDir', () => {
    test('returns log directory path under superpowers dir', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const result = getLogDir();
      const expected = path.join(tempDir, 'logs');

      expect(result).toBe(expected);
    });

    test('creates log directory if it does not exist', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const result = getLogDir();

      expect(fs.existsSync(result)).toBe(true);
    });
  });

  describe('getLogFilePath', () => {
    test('returns log file path with current date', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const result = getLogFilePath();
      const today = new Date().toISOString().split('T')[0];
      const expected = path.join(tempDir, 'logs', `${today}.log`);

      expect(result).toBe(expected);
    });

    test('log file name format is YYYY-MM-DD.log', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const result = getLogFilePath();
      const fileName = path.basename(result);

      // Should match YYYY-MM-DD.log format
      expect(fileName).toMatch(/^\d{4}-\d{2}-\d{2}\.log$/);
    });
  });

  describe('integration tests', () => {
    test('all directory paths are under the base config directory', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const archiveDir = getArchiveDir();
      const indexDir = getIndexDir();
      const logDir = getLogDir();

      // All should be subdirectories of the config dir
      expect(archiveDir.startsWith(tempDir)).toBe(true);
      expect(indexDir.startsWith(tempDir)).toBe(true);
      expect(logDir.startsWith(tempDir)).toBe(true);
    });

    test('all directories are created when accessed', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const archiveDir = getArchiveDir();
      const indexDir = getIndexDir();
      const logDir = getLogDir();

      expect(fs.existsSync(archiveDir)).toBe(true);
      expect(fs.existsSync(indexDir)).toBe(true);
      expect(fs.existsSync(logDir)).toBe(true);
    });

    test('database path is in index directory', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const dbPath = getDbPath();
      const indexDir = getIndexDir();

      expect(dbPath.startsWith(indexDir)).toBe(true);
      expect(dbPath).toBe(path.join(indexDir, 'conversations.db'));
    });

    test('exclude config path is in index directory', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const excludePath = getExcludeConfigPath();
      const indexDir = getIndexDir();

      expect(excludePath.startsWith(indexDir)).toBe(true);
      expect(excludePath).toBe(path.join(indexDir, 'exclude.txt'));
    });

    test('log file path is in log directory', () => {
      const tempDir = setupTempDir();
      process.env.CONVERSATION_MEMORY_CONFIG_DIR = tempDir;

      const logFilePath = getLogFilePath();
      const logDir = getLogDir();

      expect(logFilePath.startsWith(logDir)).toBe(true);
    });
  });
});
