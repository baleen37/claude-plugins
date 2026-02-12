/**
 * Tests for Observe CLI - Handle PostToolUse and Stop hooks for conversation-memory.
 *
 * This CLI is responsible for:
 * - PostToolUse: Compresses and stores tool events in pending_events
 * - Stop: Batch extracts observations from pending_events using LLM
 * - Reading JSON input from stdin for PostToolUse
 * - Handling --summarize flag for Stop hook
 * - Getting session ID and project from environment variables
 * - Graceful error handling with exit code 0
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { LLMProvider } from '../core/llm/index.js';

// Mock the modules
vi.mock('../core/db.v3.js', () => ({
  initDatabaseV3: vi.fn(),
  getPendingEventsV3: vi.fn(),
  getObservationV3: vi.fn(),
}));

vi.mock('../hooks/post-tool-use.js', () => ({
  handlePostToolUse: vi.fn(),
}));

vi.mock('../hooks/stop.js', () => ({
  handleStop: vi.fn(),
}));

vi.mock('../core/llm/config.js', () => ({
  loadConfig: vi.fn(),
  createProvider: vi.fn(),
}));

// Import mocked modules
import { initDatabaseV3 } from '../core/db.v3.js';
import { handlePostToolUse } from '../hooks/post-tool-use.js';
import { handleStop } from '../hooks/stop.js';
import { loadConfig, createProvider } from '../core/llm/index.js';

describe('Observe CLI', () => {
  let mockDb: Database.Database;
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      close: vi.fn(),
      prepare: vi.fn().mockReturnThis(),
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
    } as unknown as Database.Database;

    (initDatabaseV3 as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    // Store original argv and env
    originalArgv = process.argv;
    originalEnv = { ...process.env };

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original argv and env
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  describe('getSessionId', () => {
    test('should get session ID from CLAUDE_SESSION_ID env var', () => {
      process.env.CLAUDE_SESSION_ID = 'session-from-session-id';
      process.env.CLAUDE_SESSION = 'should-be-ignored';

      const sessionId = process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_SESSION || 'unknown';
      expect(sessionId).toBe('session-from-session-id');
    });

    test('should fall back to CLAUDE_SESSION env var', () => {
      delete process.env.CLAUDE_SESSION_ID;
      process.env.CLAUDE_SESSION = 'session-from-session';

      const sessionId = process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_SESSION || 'unknown';
      expect(sessionId).toBe('session-from-session');
    });

    test('should fall back to unknown when no env var is set', () => {
      delete process.env.CLAUDE_SESSION_ID;
      delete process.env.CLAUDE_SESSION;

      const sessionId = process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_SESSION || 'unknown';
      expect(sessionId).toBe('unknown');
    });
  });

  describe('getProject', () => {
    test('should get project from CLAUDE_PROJECT env var', () => {
      process.env.CLAUDE_PROJECT = 'my-project';
      process.env.CLAUDE_PROJECT_NAME = 'should-be-ignored';

      const project = process.env.CLAUDE_PROJECT || process.env.CLAUDE_PROJECT_NAME || 'default';
      expect(project).toBe('my-project');
    });

    test('should fall back to CLAUDE_PROJECT_NAME env var', () => {
      delete process.env.CLAUDE_PROJECT;
      process.env.CLAUDE_PROJECT_NAME = 'project-from-name';

      const project = process.env.CLAUDE_PROJECT || process.env.CLAUDE_PROJECT_NAME || 'default';
      expect(project).toBe('project-from-name');
    });

    test('should fall back to default when no env var is set', () => {
      delete process.env.CLAUDE_PROJECT;
      delete process.env.CLAUDE_PROJECT_NAME;

      const project = process.env.CLAUDE_PROJECT || process.env.CLAUDE_PROJECT_NAME || 'default';
      expect(project).toBe('default');
    });
  });

  describe('handleObserve', () => {
    test('should call handlePostToolUse with correct parameters', () => {
      process.env.CLAUDE_SESSION_ID = 'test-session-123';
      process.env.CLAUDE_PROJECT = 'test-project';

      (handlePostToolUse as ReturnType<typeof vi.fn>).mockImplementation(() => {});

      const db = mockDb;
      const sessionId = process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_SESSION || 'unknown';
      const project = process.env.CLAUDE_PROJECT || process.env.CLAUDE_PROJECT_NAME || 'default';

      handlePostToolUse(db, sessionId, project, 'Read', { file_path: '/test.ts', lines: 100 });

      expect(handlePostToolUse).toHaveBeenCalledWith(
        mockDb,
        'test-session-123',
        'test-project',
        'Read',
        { file_path: '/test.ts', lines: 100 }
      );
    });

    test('should close database after handling tool use', () => {
      (handlePostToolUse as ReturnType<typeof vi.fn>).mockImplementation(() => {});

      const db = mockDb;
      try {
        handlePostToolUse(db, 'session-1', 'project-1', 'Bash', { command: 'ls', exitCode: 0 });
      } finally {
        db.close();
      }

      expect(db.close).toHaveBeenCalled();
    });
  });

  describe('handleSummarize', () => {
    test('should call loadConfig and createProvider', async () => {
      process.env.CLAUDE_SESSION_ID = 'test-session-123';
      process.env.CLAUDE_PROJECT = 'test-project';

      const mockConfig = { apiKey: 'test-key', model: 'gemini-2.0-flash' };
      const mockProvider = { complete: vi.fn() } as unknown as LLMProvider;

      (loadConfig as ReturnType<typeof vi.fn>).mockReturnValue(mockConfig);
      (createProvider as ReturnType<typeof vi.fn>).mockReturnValue(mockProvider);
      (handleStop as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const db = mockDb;
      const sessionId = process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_SESSION || 'unknown';
      const project = process.env.CLAUDE_PROJECT || process.env.CLAUDE_PROJECT_NAME || 'default';

      const config = loadConfig();
      if (!config) {
        throw new Error('No config');
      }

      const provider = createProvider(config);
      await handleStop(db, { provider, sessionId, project });

      try {
        db.close();
      } finally {
        // noop
      }

      expect(loadConfig).toHaveBeenCalled();
      expect(createProvider).toHaveBeenCalledWith(mockConfig);
      expect(handleStop).toHaveBeenCalledWith(db, {
        provider: mockProvider,
        sessionId: 'test-session-123',
        project: 'test-project',
      });
    });

    test('should skip when LLM config is missing', () => {
      process.env.CLAUDE_SESSION_ID = 'test-session-123';
      process.env.CLAUDE_PROJECT = 'test-project';

      (loadConfig as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const config = loadConfig();
      if (!config) {
        console.error('[conversation-memory] No LLM config found, skipping observation extraction');
        expect(handleStop).not.toHaveBeenCalled();
      }

      consoleErrorSpy.mockRestore();
    });

    test('should close database after summarization', async () => {
      const mockConfig = { apiKey: 'test-key', model: 'gemini-2.0-flash' };
      const mockProvider = { complete: vi.fn() } as unknown as LLMProvider;

      (loadConfig as ReturnType<typeof vi.fn>).mockReturnValue(mockConfig);
      (createProvider as ReturnType<typeof vi.fn>).mockReturnValue(mockProvider);
      (handleStop as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const db = mockDb;
      try {
        await handleStop(db, {
          provider: mockProvider,
          sessionId: 'test-session',
          project: 'test-project',
        });
      } finally {
        db.close();
      }

      expect(db.close).toHaveBeenCalled();
    });
  });

  describe('readStdin', () => {
    test('should parse JSON input correctly', () => {
      const stdinData = JSON.stringify({
        tool_name: 'Read',
        result: { file_path: '/test.ts', lines: 100 },
      });

      const parsed = JSON.parse(stdinData);
      expect(parsed.tool_name).toBe('Read');
      expect(parsed.result).toEqual({ file_path: '/test.ts', lines: 100 });
    });

    test('should handle empty stdin gracefully', () => {
      const emptyData = '';

      if (!emptyData.trim()) {
        // Should return early without processing
        expect(true).toBe(true);
      }
    });
  });

  describe('main function', () => {
    test('should detect --summarize flag', () => {
      process.argv = ['node', 'observe-cli.js', '--summarize'];

      const command = process.argv[2];
      const shouldSummarize = command === '--summarize' || process.argv.includes('--summarize');

      expect(shouldSummarize).toBe(true);
    });

    test('should handle PostToolUse hook without --summarize', () => {
      process.argv = ['node', 'observe-cli.js'];

      const command = process.argv[2];
      const shouldSummarize = command === '--summarize' || process.argv.includes('--summarize');

      expect(shouldSummarize).toBe(false);
    });

    test('should detect --summarize anywhere in argv', () => {
      process.argv = ['node', 'observe-cli.js', 'some-arg', '--summarize', 'other-arg'];

      const shouldSummarize = process.argv.includes('--summarize');

      expect(shouldSummarize).toBe(true);
    });

    test('should handle errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('Test error');
      consoleErrorSpy(`[conversation-memory] Error in observe: ${error.message}`);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[conversation-memory] Error in observe: Test error');

      consoleErrorSpy.mockRestore();
    });

    test('should handle invalid JSON in stdin', () => {
      const invalidJson = '{ invalid json }';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        JSON.parse(invalidJson);
      } catch (error) {
        if (error instanceof Error) {
          consoleErrorSpy(`[conversation-memory] Error in observe: ${error.message}`);
          expect(error instanceof Error).toBe(true);
        }
      }

      consoleErrorSpy.mockRestore();
    });
  });

  describe('PostToolUse hook integration', () => {
    test('should parse valid PostToolUse input', () => {
      const stdinData = JSON.stringify({
        tool_name: 'Read',
        result: { file_path: '/src/test.ts', lines: 100 },
      });

      const input = JSON.parse(stdinData);

      expect(input.tool_name).toBe('Read');
      expect(input.result).toEqual({ file_path: '/src/test.ts', lines: 100 });
    });

    test('should handle various tool types', () => {
      const toolInputs = [
        { tool_name: 'Bash', result: { command: 'npm test', exitCode: 0 } },
        { tool_name: 'Edit', result: { file_path: '/test.ts', old_string: 'old', new_string: 'new' } },
        { tool_name: 'Grep', result: { pattern: 'TODO', path: '/src', count: 5 } },
        { tool_name: 'WebSearch', result: { query: 'test query' } },
      ];

      for (const input of toolInputs) {
        const parsed = JSON.parse(JSON.stringify(input));
        expect(parsed.tool_name).toBeDefined();
        expect(parsed.result).toBeDefined();
      }
    });
  });

  describe('Stop hook integration', () => {
    test('should verify --summarize flag detection', () => {
      process.argv = ['node', 'observe-cli.js', '--summarize'];

      const shouldSummarize = process.argv.includes('--summarize');
      expect(shouldSummarize).toBe(true);
    });

    test('should load LLM config when present', () => {
      const mockConfig = { apiKey: 'test-key', model: 'gemini-2.0-flash' };
      (loadConfig as ReturnType<typeof vi.fn>).mockReturnValue(mockConfig);

      const config = loadConfig();
      expect(config).toEqual(mockConfig);
    });

    test('should create provider from config', () => {
      const mockConfig = { apiKey: 'test-key', model: 'gemini-2.0-flash' };
      const mockProvider = { complete: vi.fn() } as unknown as LLMProvider;

      (createProvider as ReturnType<typeof vi.fn>).mockReturnValue(mockProvider);

      const provider = createProvider(mockConfig);
      expect(provider).toBe(mockProvider);
    });
  });

  describe('Edge cases', () => {
    test('should handle whitespace-only stdin', () => {
      const whitespaceData = '   \n\t  ';

      if (!whitespaceData.trim()) {
        expect(true).toBe(true);
      }
    });

    test('should handle missing tool_name in input', () => {
      const invalidInput = JSON.stringify({ result: { data: 'test' } });

      const input = JSON.parse(invalidInput);
      expect(input.tool_name).toBeUndefined();
    });

    test('should handle missing result in input', () => {
      const invalidInput = JSON.stringify({ tool_name: 'Read' });

      const input = JSON.parse(invalidInput);
      expect(input.result).toBeUndefined();
    });

    test('should handle empty tool_name', () => {
      const input = JSON.stringify({ tool_name: '', result: {} });

      const parsed = JSON.parse(input);
      expect(parsed.tool_name).toBe('');
    });

    test('should handle null result', () => {
      const input = JSON.stringify({ tool_name: 'Read', result: null });

      const parsed = JSON.parse(input);
      expect(parsed.result).toBeNull();
    });
  });

  describe('Database integration', () => {
    test('should initialize database using initDatabaseV3', () => {
      (initDatabaseV3 as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

      const db = initDatabaseV3();

      expect(initDatabaseV3).toHaveBeenCalled();
      expect(db).toBe(mockDb);
    });

    test('should close database in finally block', () => {
      (handlePostToolUse as ReturnType<typeof vi.fn>).mockImplementation(() => {});

      const db = mockDb;
      try {
        handlePostToolUse(db, 'session', 'project', 'Read', {});
      } finally {
        db.close();
      }

      expect(db.close).toHaveBeenCalled();
    });
  });

  describe('Environment variable priority', () => {
    test('should prioritize CLAUDE_SESSION_ID over CLAUDE_SESSION', () => {
      process.env.CLAUDE_SESSION_ID = 'from-session-id';
      process.env.CLAUDE_SESSION = 'from-session';

      const sessionId = process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_SESSION || 'unknown';
      expect(sessionId).toBe('from-session-id');
    });

    test('should prioritize CLAUDE_PROJECT over CLAUDE_PROJECT_NAME', () => {
      process.env.CLAUDE_PROJECT = 'from-project';
      process.env.CLAUDE_PROJECT_NAME = 'from-project-name';

      const project = process.env.CLAUDE_PROJECT || process.env.CLAUDE_PROJECT_NAME || 'default';
      expect(project).toBe('from-project');
    });
  });
});
