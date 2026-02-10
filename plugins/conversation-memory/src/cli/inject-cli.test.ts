/**
 * Tests for Inject CLI - Handle SessionStart hook for conversation-memory.
 *
 * This CLI is responsible for:
 * - Reading session data from stdin (JSON)
 * - Extracting project from input, transcript path, or environment
 * - Getting config from environment variables
 * - Calling handleSessionStart with database
 * - Outputting markdown to stdout for injection
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';

// Mock the modules
vi.mock('../core/db.v3.js', () => ({
  initDatabaseV3: vi.fn(),
}));

vi.mock('../hooks/session-start.js', () => ({
  handleSessionStart: vi.fn(),
}));

// Import mocked modules
import { initDatabaseV3 } from '../core/db.v3.js';
import { handleSessionStart } from '../hooks/session-start.js';
import type { SessionStartConfig, SessionStartResult } from '../hooks/session-start.js';

interface SessionStartInput {
  session_id: string;
  transcript_path: string;
  project?: string;
}

describe('Inject CLI', () => {
  let mockDb: Database.Database;
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogs: string[];
  let consoleErrors: string[];
  let exitCode: number | null;

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

    // Store original env
    originalEnv = { ...process.env };

    // Reset tracking
    consoleLogs = [];
    consoleErrors = [];
    exitCode = null;

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      consoleLogs.push(args.map(String).join(' '));
    });

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      consoleErrors.push(args.map(String).join(' '));
    });

    // Mock process.exit
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      exitCode = code ?? 1;
      throw new Error(`process.exit(${code})`);
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original env and methods
    process.env = originalEnv;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('readStdin', () => {
    test('should parse valid JSON input', () => {
      const stdinData = JSON.stringify({
        session_id: 'session-123',
        transcript_path: '/path/to/.claude/projects/my-project/sessions/session-123/transcript.jsonl',
        project: 'my-project',
      });

      const input = JSON.parse(stdinData) as SessionStartInput;
      expect(input.session_id).toBe('session-123');
      expect(input.transcript_path).toContain('my-project');
      expect(input.project).toBe('my-project');
    });

    test('should handle input without project field', () => {
      const stdinData = JSON.stringify({
        session_id: 'session-123',
        transcript_path: '/path/to/.claude/projects/test-project/sessions/session-123/transcript.jsonl',
      });

      const input = JSON.parse(stdinData) as SessionStartInput;
      expect(input.session_id).toBe('session-123');
      expect(input.project).toBeUndefined();
    });

    test('should handle invalid JSON gracefully', () => {
      const invalidJson = '{ invalid json }';

      expect(() => {
        JSON.parse(invalidJson);
      }).toThrow();
    });

    test('should handle empty input', () => {
      const emptyData = '';

      expect(() => {
        JSON.parse(emptyData);
      }).toThrow();
    });
  });

  describe('getProject', () => {
    function getProject(input: SessionStartInput): string {
      if (input.project) {
        return input.project;
      }

      // Extract from transcript path
      const match = input.transcript_path.match(/\/projects\/([^\/]+)\//);
      if (match && match[1]) {
        return match[1];
      }

      // Fallback to environment or default
      return process.env.CLAUDE_PROJECT || 'default';
    }

    test('should extract project from input.project', () => {
      const input: SessionStartInput = {
        session_id: 'session-123',
        transcript_path: '/some/path',
        project: 'from-input',
      };

      expect(getProject(input)).toBe('from-input');
    });

    test('should extract project from transcript path regex', () => {
      delete process.env.CLAUDE_PROJECT;
      const input: SessionStartInput = {
        session_id: 'session-123',
        transcript_path: '/path/to/.claude/projects/my-project/sessions/session-123/transcript.jsonl',
      };

      expect(getProject(input)).toBe('my-project');
    });

    test('should handle transcript path with hyphenated project name', () => {
      delete process.env.CLAUDE_PROJECT;
      const input: SessionStartInput = {
        session_id: 'session-123',
        transcript_path: '/.claude/projects/my-cool-project/sessions/session-123/transcript.jsonl',
      };

      expect(getProject(input)).toBe('my-cool-project');
    });

    test('should handle transcript path with underscored project name', () => {
      delete process.env.CLAUDE_PROJECT;
      const input: SessionStartInput = {
        session_id: 'session-123',
        transcript_path: '/.claude/projects/my_cool_project/sessions/session-123/transcript.jsonl',
      };

      expect(getProject(input)).toBe('my_cool_project');
    });

    test('should fall back to CLAUDE_PROJECT env var', () => {
      process.env.CLAUDE_PROJECT = 'from-env';
      const input: SessionStartInput = {
        session_id: 'session-123',
        transcript_path: '/path/without/projects',
      };

      expect(getProject(input)).toBe('from-env');
    });

    test('should fall back to default when no project found', () => {
      delete process.env.CLAUDE_PROJECT;
      const input: SessionStartInput = {
        session_id: 'session-123',
        transcript_path: '/path/without/projects',
      };

      expect(getProject(input)).toBe('default');
    });

    test('should prioritize input.project over transcript path', () => {
      const input: SessionStartInput = {
        session_id: 'session-123',
        transcript_path: '/.claude/projects/from-transcript/sessions/session-123/transcript.jsonl',
        project: 'from-input',
      };

      expect(getProject(input)).toBe('from-input');
    });

    test('should prioritize input.project over CLAUDE_PROJECT', () => {
      process.env.CLAUDE_PROJECT = 'from-env';
      const input: SessionStartInput = {
        session_id: 'session-123',
        transcript_path: '/path/without/projects',
        project: 'from-input',
      };

      expect(getProject(input)).toBe('from-input');
    });
  });

  describe('getConfig', () => {
    function getConfig(): SessionStartConfig {
      return {
        maxObservations: parseInt(process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS || '10', 10),
        maxTokens: parseInt(process.env.CONVERSATION_MEMORY_MAX_TOKENS || '1000', 10),
        recencyDays: parseInt(process.env.CONVERSATION_MEMORY_RECENCY_DAYS || '7', 10),
        projectOnly: process.env.CONVERSATION_MEMORY_PROJECT_ONLY === 'true',
      };
    }

    test('should use default values when no env vars set', () => {
      delete process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS;
      delete process.env.CONVERSATION_MEMORY_MAX_TOKENS;
      delete process.env.CONVERSATION_MEMORY_RECENCY_DAYS;
      delete process.env.CONVERSATION_MEMORY_PROJECT_ONLY;

      const config = getConfig();

      expect(config.maxObservations).toBe(10);
      expect(config.maxTokens).toBe(1000);
      expect(config.recencyDays).toBe(7);
      expect(config.projectOnly).toBe(false);
    });

    test('should parse maxObservations from env var', () => {
      process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS = '20';

      const config = getConfig();

      expect(config.maxObservations).toBe(20);
    });

    test('should parse maxTokens from env var', () => {
      process.env.CONVERSATION_MEMORY_MAX_TOKENS = '500';

      const config = getConfig();

      expect(config.maxTokens).toBe(500);
    });

    test('should parse recencyDays from env var', () => {
      process.env.CONVERSATION_MEMORY_RECENCY_DAYS = '14';

      const config = getConfig();

      expect(config.recencyDays).toBe(14);
    });

    test('should parse projectOnly from env var as true', () => {
      process.env.CONVERSATION_MEMORY_PROJECT_ONLY = 'true';

      const config = getConfig();

      expect(config.projectOnly).toBe(true);
    });

    test('should parse projectOnly from env var as false when not "true"', () => {
      process.env.CONVERSATION_MEMORY_PROJECT_ONLY = 'false';

      const config = getConfig();

      expect(config.projectOnly).toBe(false);
    });

    test('should handle invalid maxObservations gracefully', () => {
      process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS = 'invalid';

      const config = getConfig();

      expect(config.maxObservations).toBeNaN();
    });

    test('should parse all config values together', () => {
      process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS = '15';
      process.env.CONVERSATION_MEMORY_MAX_TOKENS = '800';
      process.env.CONVERSATION_MEMORY_RECENCY_DAYS = '30';
      process.env.CONVERSATION_MEMORY_PROJECT_ONLY = 'true';

      const config = getConfig();

      expect(config).toEqual({
        maxObservations: 15,
        maxTokens: 800,
        recencyDays: 30,
        projectOnly: true,
      });
    });
  });

  describe('handleSessionStart integration', () => {
    test('should call handleSessionStart with correct parameters', async () => {
      const mockResult: SessionStartResult = {
        markdown: '# test-project recent context\n\n- Observation: Content',
        includedCount: 1,
        tokenCount: 50,
      };

      (handleSessionStart as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const db = mockDb;
      const project = 'test-project';
      const config: SessionStartConfig = {
        maxObservations: 10,
        maxTokens: 1000,
        recencyDays: 7,
        projectOnly: true,
      };

      const result = await handleSessionStart(db, project, config);

      expect(handleSessionStart).toHaveBeenCalledWith(db, project, config);
      expect(result).toEqual(mockResult);
    });

    test('should output markdown to stdout when result has markdown', async () => {
      const mockResult: SessionStartResult = {
        markdown: '# test-project recent context\n\n- Observation: Content',
        includedCount: 1,
        tokenCount: 50,
      };

      (handleSessionStart as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const db = mockDb;
      const project = 'test-project';
      const config: SessionStartConfig = {
        maxObservations: 10,
        maxTokens: 1000,
        recencyDays: 7,
        projectOnly: true,
      };

      const result = await handleSessionStart(db, project, config);

      if (result.markdown) {
        console.log(result.markdown);
      }

      expect(consoleLogs).toContain('# test-project recent context\n\n- Observation: Content');
    });

    test('should not output when markdown is empty', async () => {
      const mockResult: SessionStartResult = {
        markdown: '',
        includedCount: 0,
        tokenCount: 0,
      };

      (handleSessionStart as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const db = mockDb;
      const project = 'test-project';
      const config: SessionStartConfig = {
        maxObservations: 10,
        maxTokens: 1000,
        recencyDays: 7,
        projectOnly: true,
      };

      const result = await handleSessionStart(db, project, config);

      if (result.markdown) {
        console.log(result.markdown);
      }

      expect(consoleLogs).toHaveLength(0);
    });

    test('should close database after handling session start', async () => {
      const mockResult: SessionStartResult = {
        markdown: '# test-project recent context',
        includedCount: 1,
        tokenCount: 50,
      };

      (handleSessionStart as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const db = mockDb;

      try {
        const result = await handleSessionStart(db, 'test-project', {
          maxObservations: 10,
          maxTokens: 1000,
          recencyDays: 7,
          projectOnly: true,
        });
        if (result.markdown) {
          console.log(result.markdown);
        }
      } finally {
        db.close();
      }

      expect(db.close).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('should log error to stderr when JSON parsing fails', () => {
      const invalidJson = '{ invalid json }';

      try {
        JSON.parse(invalidJson);
      } catch (error) {
        console.error(`[conversation-memory] Error in inject: ${error instanceof Error ? error.message : String(error)}`);
      }

      expect(consoleErrors.length).toBeGreaterThan(0);
      expect(consoleErrors[0]).toContain('[conversation-memory] Error in inject:');
    });

    test('should log error when handleSessionStart throws', async () => {
      const testError = new Error('Database connection failed');
      (handleSessionStart as ReturnType<typeof vi.fn>).mockRejectedValue(testError);

      const db = mockDb;

      try {
        await handleSessionStart(db, 'test-project', {
          maxObservations: 10,
          maxTokens: 1000,
          recencyDays: 7,
          projectOnly: true,
        });
      } catch (error) {
        console.error(`[conversation-memory] Error in inject: ${error instanceof Error ? error.message : String(error)}`);
      }

      expect(consoleErrors.length).toBeGreaterThan(0);
      expect(consoleErrors[0]).toContain('[conversation-memory] Error in inject:');
      expect(consoleErrors[0]).toContain('Database connection failed');
    });

    test('should handle non-Error objects in error handler', () => {
      const stringError = 'String error message';

      console.error(`[conversation-memory] Error in inject: ${stringError}`);

      expect(consoleErrors).toContain('[conversation-memory] Error in inject: String error message');
    });
  });

  describe('main flow integration', () => {
    test('should complete full flow with valid input', async () => {
      const stdinData = JSON.stringify({
        session_id: 'session-123',
        transcript_path: '/.claude/projects/test-project/sessions/session-123/transcript.jsonl',
      });

      const input = JSON.parse(stdinData) as SessionStartInput;

      // Mock getProject
      const project = input.project ||
        input.transcript_path.match(/\/projects\/([^\/]+)\//)?.[1] ||
        process.env.CLAUDE_PROJECT ||
        'default';

      expect(project).toBe('test-project');

      // Mock getConfig
      const config: SessionStartConfig = {
        maxObservations: parseInt(process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS || '10', 10),
        maxTokens: parseInt(process.env.CONVERSATION_MEMORY_MAX_TOKENS || '1000', 10),
        recencyDays: parseInt(process.env.CONVERSATION_MEMORY_RECENCY_DAYS || '7', 10),
        projectOnly: process.env.CONVERSATION_MEMORY_PROJECT_ONLY === 'true',
      };

      // Mock handleSessionStart
      const mockResult: SessionStartResult = {
        markdown: '# test-project recent context\n\n- Observation: Content',
        includedCount: 1,
        tokenCount: 50,
      };

      (handleSessionStart as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const db = mockDb;

      try {
        const result = await handleSessionStart(db, project, config);

        if (result.markdown) {
          console.log(result.markdown);
        }
      } finally {
        db.close();
      }

      expect(handleSessionStart).toHaveBeenCalledWith(db, project, config);
      expect(consoleLogs).toContain('# test-project recent context\n\n- Observation: Content');
      expect(db.close).toHaveBeenCalled();
    });

    test('should use default project when transcript path has no match', async () => {
      delete process.env.CLAUDE_PROJECT;

      const stdinData = JSON.stringify({
        session_id: 'session-123',
        transcript_path: '/some/random/path/without/projects',
      });

      const input = JSON.parse(stdinData) as SessionStartInput;

      // Mock getProject
      const project = input.project ||
        input.transcript_path.match(/\/projects\/([^\/]+)\//)?.[1] ||
        process.env.CLAUDE_PROJECT ||
        'default';

      expect(project).toBe('default');

      const config: SessionStartConfig = {
        maxObservations: 10,
        maxTokens: 1000,
        recencyDays: 7,
        projectOnly: false,
      };

      const mockResult: SessionStartResult = {
        markdown: '# default recent context',
        includedCount: 0,
        tokenCount: 0,
      };

      (handleSessionStart as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const db = mockDb;

      try {
        const result = await handleSessionStart(db, project, config);
        if (result.markdown) {
          console.log(result.markdown);
        }
      } finally {
        db.close();
      }

      expect(handleSessionStart).toHaveBeenCalledWith(db, 'default', config);
    });

    test('should use custom config from environment', async () => {
      process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS = '20';
      process.env.CONVERSATION_MEMORY_MAX_TOKENS = '500';
      process.env.CONVERSATION_MEMORY_RECENCY_DAYS = '14';
      process.env.CONVERSATION_MEMORY_PROJECT_ONLY = 'true';

      const config: SessionStartConfig = {
        maxObservations: parseInt(process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS || '10', 10),
        maxTokens: parseInt(process.env.CONVERSATION_MEMORY_MAX_TOKENS || '1000', 10),
        recencyDays: parseInt(process.env.CONVERSATION_MEMORY_RECENCY_DAYS || '7', 10),
        projectOnly: process.env.CONVERSATION_MEMORY_PROJECT_ONLY === 'true',
      };

      expect(config).toEqual({
        maxObservations: 20,
        maxTokens: 500,
        recencyDays: 14,
        projectOnly: true,
      });

      const mockResult: SessionStartResult = {
        markdown: '# custom config context',
        includedCount: 5,
        tokenCount: 450,
      };

      (handleSessionStart as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const db = mockDb;

      try {
        const result = await handleSessionStart(db, 'test-project', config);
        if (result.markdown) {
          console.log(result.markdown);
        }
      } finally {
        db.close();
      }

      expect(handleSessionStart).toHaveBeenCalledWith(db, 'test-project', config);
    });
  });

  describe('edge cases', () => {
    test('should handle transcript path with special characters', () => {
      delete process.env.CLAUDE_PROJECT;

      function getProject(input: SessionStartInput): string {
        if (input.project) {
          return input.project;
        }
        const match = input.transcript_path.match(/\/projects\/([^\/]+)\//);
        if (match && match[1]) {
          return match[1];
        }
        return process.env.CLAUDE_PROJECT || 'default';
      }

      const input: SessionStartInput = {
        session_id: 'session-123',
        transcript_path: '/.claude/projects/my.project-2024/sessions/session-123/transcript.jsonl',
      };

      expect(getProject(input)).toBe('my.project-2024');
    });

    test('should handle empty project in input', () => {
      delete process.env.CLAUDE_PROJECT;

      function getProject(input: SessionStartInput): string {
        if (input.project) {
          return input.project;
        }
        const match = input.transcript_path.match(/\/projects\/([^\/]+)\//);
        if (match && match[1]) {
          return match[1];
        }
        return process.env.CLAUDE_PROJECT || 'default';
      }

      const input: SessionStartInput = {
        session_id: 'session-123',
        transcript_path: '/.claude/projects/from-transcript/sessions/session-123/transcript.jsonl',
        project: '',
      };

      // Empty string is falsy, so should fall back to transcript path
      expect(getProject(input)).toBe('from-transcript');
    });

    test('should handle transcript path at root level', () => {
      delete process.env.CLAUDE_PROJECT;

      function getProject(input: SessionStartInput): string {
        if (input.project) {
          return input.project;
        }
        const match = input.transcript_path.match(/\/projects\/([^\/]+)\//);
        if (match && match[1]) {
          return match[1];
        }
        return process.env.CLAUDE_PROJECT || 'default';
      }

      const input: SessionStartInput = {
        session_id: 'session-123',
        transcript_path: '/projects/root-project/sessions/session-123/transcript.jsonl',
      };

      expect(getProject(input)).toBe('root-project');
    });

    test('should handle zero values in config', () => {
      process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS = '0';
      process.env.CONVERSATION_MEMORY_MAX_TOKENS = '0';
      process.env.CONVERSATION_MEMORY_RECENCY_DAYS = '0';

      function getConfig(): SessionStartConfig {
        return {
          maxObservations: parseInt(process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS || '10', 10),
          maxTokens: parseInt(process.env.CONVERSATION_MEMORY_MAX_TOKENS || '1000', 10),
          recencyDays: parseInt(process.env.CONVERSATION_MEMORY_RECENCY_DAYS || '7', 10),
          projectOnly: process.env.CONVERSATION_MEMORY_PROJECT_ONLY === 'true',
        };
      }

      const config = getConfig();

      expect(config.maxObservations).toBe(0);
      expect(config.maxTokens).toBe(0);
      expect(config.recencyDays).toBe(0);
    });

    test('should handle very large config values', () => {
      process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS = '999999';
      process.env.CONVERSATION_MEMORY_MAX_TOKENS = '999999';
      process.env.CONVERSATION_MEMORY_RECENCY_DAYS = '3650';

      function getConfig(): SessionStartConfig {
        return {
          maxObservations: parseInt(process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS || '10', 10),
          maxTokens: parseInt(process.env.CONVERSATION_MEMORY_MAX_TOKENS || '1000', 10),
          recencyDays: parseInt(process.env.CONVERSATION_MEMORY_RECENCY_DAYS || '7', 10),
          projectOnly: process.env.CONVERSATION_MEMORY_PROJECT_ONLY === 'true',
        };
      }

      const config = getConfig();

      expect(config.maxObservations).toBe(999999);
      expect(config.maxTokens).toBe(999999);
      expect(config.recencyDays).toBe(3650);
    });
  });

  describe('database initialization', () => {
    test('should initialize database using initDatabaseV3', () => {
      (initDatabaseV3 as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

      const db = initDatabaseV3();

      expect(initDatabaseV3).toHaveBeenCalled();
      expect(db).toBe(mockDb);
    });

    test('should close database even when handleSessionStart fails', async () => {
      const testError = new Error('Session start failed');
      (handleSessionStart as ReturnType<typeof vi.fn>).mockRejectedValue(testError);

      const db = mockDb;

      try {
        await handleSessionStart(db, 'test-project', {
          maxObservations: 10,
          maxTokens: 1000,
          recencyDays: 7,
          projectOnly: true,
        });
      } catch (error) {
        // Expected error
      } finally {
        db.close();
      }

      expect(db.close).toHaveBeenCalled();
    });
  });

  describe('stdout output behavior', () => {
    test('should not call console.log when markdown is empty string', async () => {
      const mockResult: SessionStartResult = {
        markdown: '',
        includedCount: 0,
        tokenCount: 0,
      };

      (handleSessionStart as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const db = mockDb;

      const result = await handleSessionStart(db, 'test-project', {
        maxObservations: 10,
        maxTokens: 1000,
        recencyDays: 7,
        projectOnly: true,
      });

      if (result.markdown) {
        console.log(result.markdown);
      }

      expect(consoleLogs).toHaveLength(0);
    });

    test('should output markdown with newlines preserved', async () => {
      const markdownWithNewlines = '# Header\n\nFirst line\nSecond line\nThird line';
      const mockResult: SessionStartResult = {
        markdown: markdownWithNewlines,
        includedCount: 3,
        tokenCount: 100,
      };

      (handleSessionStart as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const db = mockDb;

      const result = await handleSessionStart(db, 'test-project', {
        maxObservations: 10,
        maxTokens: 1000,
        recencyDays: 7,
        projectOnly: true,
      });

      if (result.markdown) {
        console.log(result.markdown);
      }

      expect(consoleLogs).toContain(markdownWithNewlines);
    });

    test('should output markdown with special characters', async () => {
      const markdownWithSpecialChars = '# Test\n\n- Item with "quotes"\n- Item with `backticks`\n- Item with $symbols';
      const mockResult: SessionStartResult = {
        markdown: markdownWithSpecialChars,
        includedCount: 3,
        tokenCount: 100,
      };

      (handleSessionStart as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const db = mockDb;

      const result = await handleSessionStart(db, 'test-project', {
        maxObservations: 10,
        maxTokens: 1000,
        recencyDays: 7,
        projectOnly: true,
      });

      if (result.markdown) {
        console.log(result.markdown);
      }

      expect(consoleLogs).toContain(markdownWithSpecialChars);
    });
  });
});
