/**
 * Tests for PostToolUse hook that stores compressed tool events.
 *
 * This hook is responsible for:
 * 1. Getting compressed tool data using compress.ts
 * 2. Skipping tools that return null (low value)
 * 3. Storing in pending_events table
 * 4. Running async (non-blocking)
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { compressToolData } from '../core/compress.js';
import { initDatabaseV3, insertPendingEventV3, getPendingEventsV3 } from '../core/db.v3.js';
import { handlePostToolUse } from './post-tool-use.js';

describe('PostToolUse Hook', () => {
  let db: Database.Database;
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  beforeEach(() => {
    // Use in-memory database for testing
    process.env.TEST_DB_PATH = ':memory:';
    db = initDatabaseV3();

    // Save original environment and cwd
    originalEnv = { ...process.env };
    originalCwd = process.cwd();

    // Set up test environment
    process.env.CLAUDE_SESSION_ID = 'test-session-123';
  });

  afterEach(() => {
    if (db) {
      db.close();
    }

    // Restore environment and cwd
    process.env = originalEnv;
    process.chdir(originalCwd);
  });

  describe('handlePostToolUse', () => {
    test('stores compressed tool data in pending_events', async () => {
      const toolData = {
        file_path: '/src/test.ts',
        lines: 100
      };

      await handlePostToolUse(db, 'Read', toolData, 'test-project');

      const events = getPendingEventsV3(db, 'test-session-123', 10);
      expect(events).toHaveLength(1);
      expect(events[0].toolName).toBe('Read');
      expect(events[0].compressed).toBe('Read /src/test.ts (100 lines)');
      expect(events[0].project).toBe('test-project');
      expect(events[0].sessionId).toBe('test-session-123');
    });

    test('skips tools that return null from compression', async () => {
      const toolData = { pattern: 'test' };

      await handlePostToolUse(db, 'Glob', toolData, 'test-project');

      const events = getPendingEventsV3(db, 'test-session-123', 10);
      expect(events).toHaveLength(0);
    });

    test('includes timestamp and createdAt fields', async () => {
      const beforeTime = Date.now();
      const toolData = { command: 'echo test', exitCode: 0 };

      await handlePostToolUse(db, 'Bash', toolData, 'test-project');

      const afterTime = Date.now();
      const events = getPendingEventsV3(db, 'test-session-123', 10);

      expect(events).toHaveLength(1);
      expect(events[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(events[0].timestamp).toBeLessThanOrEqual(afterTime);
      expect(events[0].createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(events[0].createdAt).toBeLessThanOrEqual(afterTime);
    });

    test('handles Edit tool compression', async () => {
      const toolData = {
        file_path: '/src/auth.ts',
        old_string: 'function login()',
        new_string: 'async function login()'
      };

      await handlePostToolUse(db, 'Edit', toolData, 'test-project');

      const events = getPendingEventsV3(db, 'test-session-123', 10);
      expect(events).toHaveLength(1);
      expect(events[0].toolName).toBe('Edit');
      expect(events[0].compressed).toContain('Edited /src/auth.ts:');
      expect(events[0].compressed).toContain('function login()');
      expect(events[0].compressed).toContain('→');
    });

    test('handles Write tool compression', async () => {
      const toolData = {
        file_path: '/src/new.ts',
        lines: 250
      };

      await handlePostToolUse(db, 'Write', toolData, 'test-project');

      const events = getPendingEventsV3(db, 'test-session-123', 10);
      expect(events).toHaveLength(1);
      expect(events[0].compressed).toBe('Created /src/new.ts (250 lines)');
    });

    test('handles Bash tool compression with success', async () => {
      const toolData = {
        command: 'npm test',
        exitCode: 0
      };

      await handlePostToolUse(db, 'Bash', toolData, 'test-project');

      const events = getPendingEventsV3(db, 'test-session-123', 10);
      expect(events).toHaveLength(1);
      expect(events[0].compressed).toContain('Ran `npm test` → exit 0');
    });

    test('handles Bash tool compression with error', async () => {
      const toolData = {
        command: 'npm test',
        exitCode: 1,
        stderr: 'Error: Test failed\n    at test.js:10:5'
      };

      await handlePostToolUse(db, 'Bash', toolData, 'test-project');

      const events = getPendingEventsV3(db, 'test-session-123', 10);
      expect(events).toHaveLength(1);
      expect(events[0].compressed).toContain('Ran `npm test` → exit 1');
      expect(events[0].compressed).toContain('Error: Test failed');
    });

    test('handles Grep tool compression', async () => {
      const toolData = {
        pattern: 'TODO',
        path: '/src',
        count: 5
      };

      await handlePostToolUse(db, 'Grep', toolData, 'test-project');

      const events = getPendingEventsV3(db, 'test-session-123', 10);
      expect(events).toHaveLength(1);
      expect(events[0].compressed).toContain("Searched 'TODO' in /src → 5 matches");
    });

    test('handles WebSearch tool compression', async () => {
      const toolData = {
        query: 'TypeScript best practices 2026'
      };

      await handlePostToolUse(db, 'WebSearch', toolData, 'test-project');

      const events = getPendingEventsV3(db, 'test-session-123', 10);
      expect(events).toHaveLength(1);
      expect(events[0].compressed).toBe('Searched: TypeScript best practices 2026');
    });

    test('handles WebFetch tool compression', async () => {
      const toolData = {
        url: 'https://example.com/api/docs'
      };

      await handlePostToolUse(db, 'WebFetch', toolData, 'test-project');

      const events = getPendingEventsV3(db, 'test-session-123', 10);
      expect(events).toHaveLength(1);
      expect(events[0].compressed).toBe('Fetched https://example.com/api/docs');
    });

    test('handles multiple tool events in sequence', async () => {
      await handlePostToolUse(db, 'Read', { file_path: '/src/a.ts', lines: 10 }, 'test-project');
      await handlePostToolUse(db, 'Read', { file_path: '/src/b.ts', lines: 20 }, 'test-project');
      await handlePostToolUse(db, 'Bash', { command: 'echo test', exitCode: 0 }, 'test-project');

      const events = getPendingEventsV3(db, 'test-session-123', 10);
      expect(events).toHaveLength(3);
      expect(events[0].compressed).toContain('/src/a.ts');
      expect(events[1].compressed).toContain('/src/b.ts');
      expect(events[2].compressed).toContain('echo test');
    });

    test('filters out skipped tools', async () => {
      // These tools should be skipped (return null from compress)
      const skippedTools = [
        'Glob', 'LSP', 'TodoWrite', 'TaskCreate', 'TaskUpdate',
        'TaskList', 'TaskGet', 'AskUserQuestion', 'EnterPlanMode',
        'ExitPlanMode', 'NotebookEdit', 'Skill'
      ];

      for (const toolName of skippedTools) {
        await handlePostToolUse(db, toolName, {}, 'test-project');
      }

      const events = getPendingEventsV3(db, 'test-session-123', 100);
      expect(events).toHaveLength(0);
    });

    test('uses session ID from environment', async () => {
      process.env.CLAUDE_SESSION_ID = 'custom-session-456';

      await handlePostToolUse(db, 'Read', { file_path: '/test.ts', lines: 50 }, 'test-project');

      const events = getPendingEventsV3(db, 'custom-session-456', 10);
      expect(events).toHaveLength(1);
    });

    test('handles unknown tool names', async () => {
      await handlePostToolUse(db, 'UnknownTool', { data: 'test' }, 'test-project');

      const events = getPendingEventsV3(db, 'test-session-123', 10);
      expect(events).toHaveLength(1);
      expect(events[0].compressed).toBe('UnknownTool');
    });

    test('does not throw errors on invalid input', async () => {
      // Should not throw even with null/undefined data
      await expect(
        handlePostToolUse(db, 'Read', null, 'test-project')
      ).resolves.not.toThrow();

      await expect(
        handlePostToolUse(db, 'Read', undefined, 'test-project')
      ).resolves.not.toThrow();
    });

    test('compresses tool data correctly for all supported tools', () => {
      // Test the compression function directly
      expect(compressToolData('Read', { file_path: '/test.ts', lines: 100 }))
        .toBe('Read /test.ts (100 lines)');

      expect(compressToolData('Glob', { pattern: '*.ts' }))
        .toBeNull(); // Skipped

      expect(compressToolData('Edit', {
        file_path: '/test.ts',
        old_string: 'old',
        new_string: 'new'
      })).toContain('Edited /test.ts:');

      expect(compressToolData('Bash', {
        command: 'ls',
        exitCode: 0
      })).toBe('Ran `ls` → exit 0');
    });

    test('handles edge cases in compression', () => {
      // Empty file path
      expect(compressToolData('Read', {}))
        .toBe('Read');

      // Very long strings should be truncated
      const longString = 'a'.repeat(200);
      const result = compressToolData('Edit', {
        file_path: '/test.ts',
        old_string: longString,
        new_string: longString
      });
      expect(result).toContain('...');
      expect(result!.length).toBeLessThan(longString.length * 2);
    });
  });

  describe('Integration: pending_events table', () => {
    test('events can be retrieved after insertion', async () => {
      const toolData = { file_path: '/test.ts', lines: 100 };

      await handlePostToolUse(db, 'Read', toolData, 'test-project');

      const events = getPendingEventsV3(db, 'test-session-123', 10);
      expect(events).toHaveLength(1);
      expect(events[0]).toHaveProperty('id');
      expect(events[0]).toHaveProperty('sessionId');
      expect(events[0]).toHaveProperty('project');
      expect(events[0]).toHaveProperty('toolName');
      expect(events[0]).toHaveProperty('compressed');
      expect(events[0]).toHaveProperty('timestamp');
      expect(events[0]).toHaveProperty('createdAt');
    });

    test('multiple sessions do not interfere', async () => {
      process.env.CLAUDE_SESSION_ID = 'session-1';
      await handlePostToolUse(db, 'Read', { file_path: '/a.ts', lines: 10 }, 'project-1');

      process.env.CLAUDE_SESSION_ID = 'session-2';
      await handlePostToolUse(db, 'Read', { file_path: '/b.ts', lines: 20 }, 'project-2');

      const events1 = getPendingEventsV3(db, 'session-1', 10);
      const events2 = getPendingEventsV3(db, 'session-2', 10);

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
      expect(events1[0].project).toBe('project-1');
      expect(events2[0].project).toBe('project-2');
    });
  });
});
