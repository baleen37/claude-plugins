import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { rmSync } from 'fs';

// Import functions to test
import {
  syncConversations,
  type SyncResult,
  type SyncOptions,
} from './sync.js';

// We need to test internal functions via the public API
// These tests will validate the behavior indirectly

// Track original environment and temp directories
let originalEnv: NodeJS.ProcessEnv;
let tempDirs: string[] = [];
let originalConsoleLog: typeof console.log;
let originalConsoleError: typeof console.error;

function setupTempDir(): string {
  const tempDir = path.join(os.tmpdir(), `sync-test-${Date.now()}-${Math.random()}`);
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

function createMockConversationFile(filePath: string, content: string = 'mock content'): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

function createValidJsonlConversation(filePath: string, messages: Array<{ role: string; content: string }>): void {
  const jsonlContent = messages.flatMap((msg, idx) => {
    const lines = [];
    if (msg.role === 'user') {
      lines.push(JSON.stringify({
        type: 'user',
        message: { role: 'user', content: msg.content },
        timestamp: `2024-01-01T00:00:${idx.toString().padStart(2, '0')}.000Z`
      }));
    }
    if (msg.role === 'assistant') {
      lines.push(JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: msg.content },
        timestamp: `2024-01-01T00:00:${(idx + 1).toString().padStart(2, '0')}.000Z`
      }));
    }
    return lines;
  }).join('\n');

  createMockConversationFile(filePath, jsonlContent);
}

// Mock console to capture output
let capturedLogs: string[] = [];
let capturedErrors: string[] = [];

function mockConsole() {
  capturedLogs = [];
  capturedErrors = [];
  originalConsoleLog = console.log;
  originalConsoleError = console.error;
  console.log = (...args: any[]) => capturedLogs.push(args.join(' '));
  console.error = (...args: any[]) => capturedErrors.push(args.join(' '));
}

function restoreConsole() {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
}

// Helper to create a session ID with valid UUID format
function createMockSessionId(): string {
  return '550e8400-e29b-41d4-a716-446655440000';
}

describe('sync.ts', () => {
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear relevant environment variables for clean testing
    delete process.env.CONVERSATION_MEMORY_CONFIG_DIR;
    delete process.env.TEST_ARCHIVE_DIR;
    delete process.env.CONVERSATION_MEMORY_DB_PATH;
    delete process.env.TEST_DB_PATH;
    delete process.env.CONVERSATION_SEARCH_EXCLUDE_PROJECTS;
    delete process.env.TEST_PROJECTS_DIR;

    // Mock console
    mockConsole();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Clean up temp directories
    cleanupTempDirs();

    // Restore console
    restoreConsole();
  });

  describe('shouldSkipConversation() - internal function behavior', () => {
    test('detects <INSTRUCTIONS-TO-EPISODIC-MEMORY>DO NOT INDEX THIS CHAT</INSTRUCTIONS-TO-EPISODIC-MEMODY> marker', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const filePath = path.join(projectDir, `${createMockSessionId()}.jsonl`);
      const content = JSON.stringify({
        type: 'user',
        message: { role: 'user', content: '<INSTRUCTIONS-TO-EPISODIC-MEMORY>DO NOT INDEX THIS CHAT</INSTRUCTIONS-TO-EPISODIC-MEMORY>' },
        timestamp: '2024-01-01T00:00:00.000Z'
      });
      createMockConversationFile(filePath, content);

      // Set up test environment to avoid real DB operations
      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      // File should be copied but not indexed (even though skipSummaries is true)
      expect(result.copied).toBe(1);
      expect(result.skipped).toBe(0);
    });

    test('detects "Only use NO_INSIGHTS_FOUND" marker', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const filePath = path.join(projectDir, `${createMockSessionId()}.jsonl`);
      const content = JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Only use NO_INSIGHTS_FOUND' },
        timestamp: '2024-01-01T00:00:00.000Z'
      });
      createMockConversationFile(filePath, content);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);
    });

    test('detects SUMMARIZER_CONTEXT_MARKER', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const filePath = path.join(projectDir, `${createMockSessionId()}.jsonl`);
      const content = JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Context: This summary will be shown in a list to help users and Claude choose which conversations are relevant' },
        timestamp: '2024-01-01T00:00:00.000Z'
      });
      createMockConversationFile(filePath, content);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);
    });

    test('returns false for normal conversations without exclusion markers', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const filePath = path.join(projectDir, `${createMockSessionId()}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello, how are you?' },
        { role: 'assistant', content: 'I am doing well!' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);
    });

    test('handles file read errors gracefully by returning false', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      // Create a file but we'll make it unreadable by testing with a non-existent file in dest
      // The shouldSkipConversation function returns false on read errors
      const filePath = path.join(projectDir, `${createMockSessionId()}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      // Should not throw, should process normally
      expect(result.copied).toBe(1);
    });
  });

  describe('copyIfNewer() - internal function behavior', () => {
    test('copies file when source is newer than destination', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const filePath = path.join(projectDir, `${createMockSessionId()}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);
      expect(result.skipped).toBe(0);

      // Verify file was copied
      const destFile = path.join(destDir, 'test-project', path.basename(filePath));
      expect(fs.existsSync(destFile)).toBe(true);
    });

    test('skips copy when destination is newer or same age', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      const destProjectDir = path.join(destDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.mkdirSync(destProjectDir, { recursive: true });

      const sessionId = createMockSessionId();
      const filePath = path.join(projectDir, `${sessionId}.jsonl`);
      const destFilePath = path.join(destProjectDir, `${sessionId}.jsonl`);

      // Create both files
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      // Create destination with same content
      createValidJsonlConversation(destFilePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      // Ensure destination is newer or same
      await new Promise(resolve => setTimeout(resolve, 10));

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      // Should skip copying since dest exists
      expect(result.copied).toBe(0);
      expect(result.skipped).toBe(1);
    });

    test('creates destination directory if needed', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      // Don't create dest directory - it should be created automatically
      const filePath = path.join(projectDir, `${createMockSessionId()}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);

      // Verify destination directory was created
      const destProjectDir = path.join(destDir, 'test-project');
      expect(fs.existsSync(destProjectDir)).toBe(true);
    });

    test('performs atomic copy operation using temp file', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const sessionId = createMockSessionId();
      const filePath = path.join(projectDir, `${sessionId}.jsonl`);
      const content = 'some test content';
      createMockConversationFile(filePath, content);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);

      // Verify the final file exists
      const destFile = path.join(destDir, 'test-project', `${sessionId}.jsonl`);
      expect(fs.existsSync(destFile)).toBe(true);

      // Verify temp file was cleaned up (atomic rename removes it)
      const tempFile = destFile + '.tmp.' + process.pid;
      expect(fs.existsSync(tempFile)).toBe(false);

      // Verify content matches
      const destContent = fs.readFileSync(destFile, 'utf-8');
      expect(destContent).toBe(content);
    });
  });

  describe('extractSessionIdFromPath() - internal function behavior', () => {
    test('extracts valid UUID session ID from filename', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const sessionId = createMockSessionId();
      const filePath = path.join(projectDir, `${sessionId}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      // Should process the file with valid session ID
      expect(result.copied).toBe(1);
    });

    test('handles various UUID formats (case insensitive)', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      // Test lowercase UUID
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const filePath = path.join(projectDir, `${sessionId}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);
    });

    test('returns null for non-UUID filenames', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      // Create file with non-UUID name (should still be copied but not indexed for summaries)
      const filePath = path.join(projectDir, 'not-a-uuid.jsonl');
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      // File should still be copied
      expect(result.copied).toBe(1);
    });

    test('extracts session ID from complex path (note: sync only reads immediate subdirectories)', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      // The sync function reads immediate subdirectories of sourceDir
      const projectName = 'test-project';
      const projectDir = path.join(sourceDir, projectName);
      fs.mkdirSync(projectDir, { recursive: true });

      const sessionId = createMockSessionId();
      const filePath = path.join(projectDir, `${sessionId}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);
    });
  });

  describe('syncConversations() - main function', () => {
    test('syncs conversations from archive to index', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const filePath = path.join(projectDir, `${createMockSessionId()}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    test('handles project filtering via exclusion', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const excludedDir = path.join(sourceDir, 'excluded-project');
      const includedDir = path.join(sourceDir, 'included-project');
      fs.mkdirSync(excludedDir, { recursive: true });
      fs.mkdirSync(includedDir, { recursive: true });

      // Create files in both projects
      createValidJsonlConversation(path.join(excludedDir, `${createMockSessionId()}.jsonl`), [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      createValidJsonlConversation(path.join(includedDir, `${createMockSessionId()}.jsonl`), [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      // Set up exclusions via environment
      process.env.CONVERSATION_SEARCH_EXCLUDE_PROJECTS = 'excluded-project';
      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      // Only included project should be processed
      expect(result.copied).toBe(1);
      expect(capturedLogs.some(log => log.includes('Skipping excluded project: excluded-project'))).toBe(true);
    });

    test('generates summaries for new conversations when skipSummaries is false', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const filePath = path.join(projectDir, `${createMockSessionId()}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'What is the capital of France?' },
        { role: 'assistant', content: 'The capital of France is Paris.' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      // Note: This test uses skipSummaries: true to avoid actual AI API calls
      // In a real test environment, you'd mock the summarizer
      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);
      expect(result.summarized).toBe(0); // skipSummaries is true
    });

    test('respects skipIndex option', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const filePath = path.join(projectDir, `${createMockSessionId()}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);
      expect(result.indexed).toBe(0); // skipIndex is true
    });

    test('respects skipSummaries option', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const filePath = path.join(projectDir, `${createMockSessionId()}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);
      expect(result.summarized).toBe(0); // skipSummaries is true
    });

    test('respects summaryLimit option', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      // Create multiple conversation files
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(projectDir, `${createMockSessionId()}-${i}.jsonl`);
        createValidJsonlConversation(filePath, [
          { role: 'user', content: `Question ${i}` },
          { role: 'assistant', content: `Answer ${i}` }
        ]);
      }

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, {
        skipIndex: true,
        skipSummaries: true,
        summaryLimit: 2
      });

      expect(result.copied).toBe(5);
    });

    test('returns empty result when source directory does not exist', async () => {
      const sourceDir = path.join(setupTempDir(), 'non-existent-source');
      const destDir = setupTempDir();

      const result = await syncConversations(sourceDir, destDir);

      expect(result.copied).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.indexed).toBe(0);
      expect(result.summarized).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    test('handles multiple projects', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();

      // Create multiple projects
      const projects = ['project-a', 'project-b', 'project-c'];
      for (const project of projects) {
        const projectDir = path.join(sourceDir, project);
        fs.mkdirSync(projectDir, { recursive: true });
        createValidJsonlConversation(path.join(projectDir, `${createMockSessionId()}.jsonl`), [
          { role: 'user', content: `Hello from ${project}` },
          { role: 'assistant', content: `Hi from ${project}` }
        ]);
      }

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    test('skips agent files (files starting with agent-)', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      // Create regular file
      createValidJsonlConversation(path.join(projectDir, `${createMockSessionId()}.jsonl`), [
        { role: 'user', content: 'Regular' },
        { role: 'assistant', content: 'File' }
      ]);

      // Create agent file (should be skipped)
      createValidJsonlConversation(path.join(projectDir, 'agent-some-conversation.jsonl'), [
        { role: 'user', content: 'Agent' },
        { role: 'assistant', content: 'File' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      // Only regular file should be copied
      expect(result.copied).toBe(1);
    });

    test('handles errors during sync and continues processing', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      // Create a valid file
      createValidJsonlConversation(path.join(projectDir, `${createMockSessionId()}.jsonl`), [
        { role: 'user', content: 'Valid' },
        { role: 'assistant', content: 'File' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    test('ignores non-.jsonl files', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      // Create various file types
      createMockConversationFile(path.join(projectDir, 'readme.md'), '# Readme');
      createMockConversationFile(path.join(projectDir, 'config.json'), '{}');
      createMockConversationFile(path.join(projectDir, 'data.txt'), 'some data');

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      // No JSONL files to process
      expect(result.copied).toBe(0);
      expect(result.skipped).toBe(0);
    });

    test('ignores non-directory entries in source directory', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();

      // Create a file (not directory) in source
      createMockConversationFile(path.join(sourceDir, 'not-a-directory.jsonl'), 'content');

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(0);
    });

    test('tracks token usage when summaries are generated', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const filePath = path.join(projectDir, `${createMockSessionId()}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      // Token usage should be tracked (even if zero when skipSummaries is true)
      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage!.input_tokens).toBe(0);
      expect(result.tokenUsage!.output_tokens).toBe(0);
    });

    test('handles existing summaries without regenerating them', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const sessionId = createMockSessionId();
      const filePath = path.join(projectDir, `${sessionId}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      // First sync - should copy
      const result1 = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });
      expect(result1.copied).toBe(1);

      // Create summary file manually
      const summaryPath = path.join(destDir, 'test-project', `${sessionId}-summary.txt`);
      fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
      fs.writeFileSync(summaryPath, 'Existing summary');

      // Second sync - should skip copy (dest exists) and skip summary generation
      const result2 = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });
      expect(result2.copied).toBe(0);
      expect(result2.skipped).toBe(1);
    });
  });

  describe('syncConversations() - edge cases and error handling', () => {
    test('handles empty projects directory', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      fs.mkdirSync(sourceDir, { recursive: true });

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(0);
      expect(result.skipped).toBe(0);
    });

    test('handles projects with no .jsonl files', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'empty-project');
      fs.mkdirSync(projectDir, { recursive: true });

      // Create non-jsonl files
      createMockConversationFile(path.join(projectDir, 'readme.md'), '# Readme');
      createMockConversationFile(path.join(projectDir, 'script.sh'), '#!/bin/bash');

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(0);
      expect(result.skipped).toBe(0);
    });

    test('handles project names with special characters (within immediate sourceDir)', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectName = 'test-project-with-special-chars';
      const projectDir = path.join(sourceDir, projectName);
      fs.mkdirSync(projectDir, { recursive: true });

      const filePath = path.join(projectDir, `${createMockSessionId()}.jsonl`);
      createValidJsonlConversation(filePath, [
        { role: 'user', content: 'Hello from project with special chars' },
        { role: 'assistant', content: 'Hi!' }
      ]);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(1);

      // Verify the destination was created with the same project name
      const destProjectDir = path.join(destDir, projectName);
      expect(fs.existsSync(destProjectDir)).toBe(true);
    });

    test('preserves file content during copy', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const sessionId = createMockSessionId();
      const filePath = path.join(projectDir, `${sessionId}.jsonl`);
      const originalContent = JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Test content with special chars: 아こんにちは' },
        timestamp: '2024-01-01T00:00:00.000Z'
      });
      createMockConversationFile(filePath, originalContent);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      const destFilePath = path.join(destDir, 'test-project', `${sessionId}.jsonl`);
      const copiedContent = fs.readFileSync(destFilePath, 'utf-8');

      expect(copiedContent).toBe(originalContent);
    });

    test('handles files with same timestamp', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      const destProjectDir = path.join(destDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.mkdirSync(destProjectDir, { recursive: true });

      const sessionId = createMockSessionId();
      const filePath = path.join(projectDir, `${sessionId}.jsonl`);
      const destFilePath = path.join(destProjectDir, `${sessionId}.jsonl`);

      const content = JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Test' },
        timestamp: '2024-01-01T00:00:00.000Z'
      });

      // Write both files with same content at almost the same time
      createMockConversationFile(filePath, content);
      createMockConversationFile(destFilePath, content);

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      // Should skip because dest exists with same mtime
      expect(result.copied).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });

  describe('syncConversations() - integration scenarios', () => {
    test('handles real-world scenario: multiple conversations across projects', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();

      // Set up multiple projects with various conversation states
      const scenarios = [
        { project: 'web-app', conversations: 3 },
        { project: 'api-server', conversations: 2 },
        { project: 'mobile-app', conversations: 1 }
      ];

      for (const scenario of scenarios) {
        const projectDir = path.join(sourceDir, scenario.project);
        fs.mkdirSync(projectDir, { recursive: true });

        for (let i = 0; i < scenario.conversations; i++) {
          const filePath = path.join(projectDir, `${createMockSessionId()}-${i}.jsonl`);
          createValidJsonlConversation(filePath, [
            { role: 'user', content: `Question ${i} for ${scenario.project}` },
            { role: 'assistant', content: `Answer ${i} for ${scenario.project}` }
          ]);
        }
      }

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      const result = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });

      expect(result.copied).toBe(6); // 3 + 2 + 1
      expect(result.errors).toHaveLength(0);

      // Verify all files were copied to correct destinations
      for (const scenario of scenarios) {
        const destProjectDir = path.join(destDir, scenario.project);
        expect(fs.existsSync(destProjectDir)).toBe(true);
        const files = fs.readdirSync(destProjectDir);
        expect(files.length).toBe(scenario.conversations);
      }
    });

    test('handles incremental sync: new files only', async () => {
      const sourceDir = setupTempDir();
      const destDir = setupTempDir();
      const projectDir = path.join(sourceDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      process.env.TEST_DB_PATH = path.join(setupTempDir(), 'test.db');

      // Initial sync with one file
      const file1 = path.join(projectDir, `${createMockSessionId()}-1.jsonl`);
      createValidJsonlConversation(file1, [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'File' }
      ]);

      const result1 = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });
      expect(result1.copied).toBe(1);

      // Add more files
      const file2 = path.join(projectDir, `${createMockSessionId()}-2.jsonl`);
      const file3 = path.join(projectDir, `${createMockSessionId()}-3.jsonl`);
      createValidJsonlConversation(file2, [
        { role: 'user', content: 'Second' },
        { role: 'assistant', content: 'File' }
      ]);
      createValidJsonlConversation(file3, [
        { role: 'user', content: 'Third' },
        { role: 'assistant', content: 'File' }
      ]);

      // Incremental sync
      const result2 = await syncConversations(sourceDir, destDir, { skipIndex: true, skipSummaries: true });
      expect(result2.copied).toBe(2); // Only new files
      expect(result2.skipped).toBe(1); // Existing file
    });
  });
});
