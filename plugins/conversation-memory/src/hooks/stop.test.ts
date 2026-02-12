/**
 * Tests for Stop hook - batch LLM extraction from pending_events.
 *
 * This hook is responsible for:
 * 1. Collecting all pending_events for the session
 * 2. Skipping if < 3 events (too short to be useful)
 * 3. Grouping into batches of 10-20 events
 * 4. Calling Gemini with compressed event data + previous batch's last 3 observations
 * 5. Storing extracted observations with embeddings
 * 6. Runs asynchronously (non-blocking)
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabaseV3, getPendingEventsV3, getObservationV3 } from '../core/db.v3.js';
import { handlePostToolUse } from './post-tool-use.js';
import { handleStop, type StopHookOptions } from './stop.js';
import type { LLMProvider } from '../core/llm/index.js';

// Mock LLM provider
const mockLLMProvider = {
  complete: vi.fn(),
} as unknown as LLMProvider;

// Mock embeddings module
vi.mock('../core/embeddings.js', () => ({
  initEmbeddings: vi.fn().mockResolvedValue(undefined),
  generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
}));

describe('Stop Hook', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Use in-memory database for testing
    process.env.CONVERSATION_MEMORY_DB_PATH = ':memory:';
    db = initDatabaseV3();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('handleStop', () => {
    test('should skip extraction when less than 3 events', async () => {
      // Add 2 events (below threshold)
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Read', { file_path: '/src/test.ts', lines: 100 });
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Bash', { command: 'echo test', exitCode: 0 });

      const options: StopHookOptions = {
        provider: mockLLMProvider,
        sessionId: 'test-session-123',
        project: 'test-project',
      };

      await handleStop(db, options);

      // Should not call LLM provider
      expect(mockLLMProvider.complete).not.toHaveBeenCalled();

      // No observations should be created
      const obs = getObservationV3(db, 1);
      expect(obs).toBeNull();
    });

    test('should extract observations when 3 or more events', async () => {
      // Mock LLM response
      const mockComplete = vi.fn().mockResolvedValue({
        text: JSON.stringify([
          { title: 'Fixed auth bug', content: 'Resolved JWT validation issue' },
        ]),
        usage: { input_tokens: 100, output_tokens: 20 },
      });
      mockLLMProvider.complete = mockComplete;

      // Add 3 events (meets threshold)
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Read', { file_path: '/src/auth.ts', lines: 100 });
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Edit', { file_path: '/src/auth.ts', old_string: 'old', new_string: 'new' });
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Bash', { command: 'npm test', exitCode: 0 });

      const options: StopHookOptions = {
        provider: mockLLMProvider,
        sessionId: 'test-session-123',
        project: 'test-project',
      };

      await handleStop(db, options);

      // Should call LLM provider once
      expect(mockComplete).toHaveBeenCalledTimes(1);

      // Observation should be created
      const obs = getObservationV3(db, 1);
      expect(obs).not.toBeNull();
      expect(obs?.title).toBe('Fixed auth bug');
      expect(obs?.content).toBe('Resolved JWT validation issue');
      expect(obs?.sessionId).toBe('test-session-123');
      expect(obs?.project).toBe('test-project');
    });

    test('should group events into batches of 10-20', async () => {
      // Mock LLM response
      const mockComplete = vi.fn().mockResolvedValue({
        text: JSON.stringify([
          { title: 'Observation 1', content: 'Content 1' },
        ]),
        usage: { input_tokens: 100, output_tokens: 20 },
      });
      mockLLMProvider.complete = mockComplete;

      // Add 25 events (should create 2 batches: 15 + 10)
      for (let i = 0; i < 25; i++) {
        handlePostToolUse(db, 'test-session-123', 'test-project', 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }

      const options: StopHookOptions = {
        provider: mockLLMProvider,
        sessionId: 'test-session-123',
        project: 'test-project',
      };

      await handleStop(db, options);

      // Should call LLM provider twice (2 batches)
      expect(mockComplete).toHaveBeenCalledTimes(2);
    });

    test('should pass previous batch observations to next batch', async () => {
      // Mock LLM to return different observations on each call
      let callCount = 0;
      const mockComplete = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            text: JSON.stringify([
              { title: 'Obs 1', content: 'Content 1' },
              { title: 'Obs 2', content: 'Content 2' },
              { title: 'Obs 3', content: 'Content 3' },
            ]),
            usage: { input_tokens: 100, output_tokens: 40 },
          };
        } else {
          return {
            text: JSON.stringify([
              { title: 'Obs 4', content: 'Content 4' },
            ]),
            usage: { input_tokens: 100, output_tokens: 20 },
          };
        }
      });
      mockLLMProvider.complete = mockComplete;

      // Add 20 events (should create 2 batches)
      for (let i = 0; i < 20; i++) {
        handlePostToolUse(db, 'test-session-123', 'test-project', 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }

      const options: StopHookOptions = {
        provider: mockLLMProvider,
        sessionId: 'test-session-123',
        project: 'test-project',
      };

      await handleStop(db, options);

      // First call should have no previous observations
      const firstCallArgs = mockComplete.mock.calls[0];
      const firstPrompt = firstCallArgs[0] as string;
      expect(firstPrompt).not.toContain('<previous_observations>');

      // Second call should have previous observations
      const secondCallArgs = mockComplete.mock.calls[1];
      const secondPrompt = secondCallArgs[0] as string;
      expect(secondPrompt).toContain('<previous_observations>');
      expect(secondPrompt).toContain('Obs 1');
      expect(secondPrompt).toContain('Obs 2');
      expect(secondPrompt).toContain('Obs 3');
    });

    test('should handle empty LLM response (low-value batch)', async () => {
      // Mock LLM to return empty array
      const mockComplete = vi.fn().mockResolvedValue({
        text: JSON.stringify([]),
        usage: { input_tokens: 50, output_tokens: 5 },
      });
      mockLLMProvider.complete = mockComplete;

      // Add 3 events
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Read', { file_path: '/src/test.ts', lines: 100 });
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Bash', { command: 'ls', exitCode: 0 });
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Bash', { command: 'pwd', exitCode: 0 });

      const options: StopHookOptions = {
        provider: mockLLMProvider,
        sessionId: 'test-session-123',
        project: 'test-project',
      };

      await handleStop(db, options);

      // Should call LLM but not create any observations
      expect(mockComplete).toHaveBeenCalledTimes(1);
      const obs = getObservationV3(db, 1);
      expect(obs).toBeNull();
    });

    test('should handle LLM errors gracefully', async () => {
      // Mock LLM to throw error
      const mockComplete = vi.fn().mockRejectedValue(new Error('API error'));
      mockLLMProvider.complete = mockComplete;

      // Add 3 events
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Read', { file_path: '/src/test.ts', lines: 100 });
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Bash', { command: 'ls', exitCode: 0 });
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Bash', { command: 'pwd', exitCode: 0 });

      const options: StopHookOptions = {
        provider: mockLLMProvider,
        sessionId: 'test-session-123',
        project: 'test-project',
      };

      // Should not throw
      await expect(handleStop(db, options)).resolves.toBeUndefined();

      // No observations should be created
      const obs = getObservationV3(db, 1);
      expect(obs).toBeNull();
    });

    test('should only process events for the specific session', async () => {
      const mockComplete = vi.fn().mockResolvedValue({
        text: JSON.stringify([{ title: 'Test', content: 'Content' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      });
      mockLLMProvider.complete = mockComplete;

      // Add events for two different sessions
      handlePostToolUse(db, 'session-1', 'test-project', 'Read', { file_path: '/src/a.ts', lines: 100 });
      handlePostToolUse(db, 'session-1', 'test-project', 'Read', { file_path: '/src/b.ts', lines: 100 });
      handlePostToolUse(db, 'session-1', 'test-project', 'Read', { file_path: '/src/c.ts', lines: 100 });
      handlePostToolUse(db, 'session-2', 'test-project', 'Read', { file_path: '/src/d.ts', lines: 100 });
      handlePostToolUse(db, 'session-2', 'test-project', 'Read', { file_path: '/src/e.ts', lines: 100 });
      handlePostToolUse(db, 'session-2', 'test-project', 'Read', { file_path: '/src/f.ts', lines: 100 });

      // Process only session-1
      const options: StopHookOptions = {
        provider: mockLLMProvider,
        sessionId: 'session-1',
        project: 'test-project',
      };

      await handleStop(db, options);

      // Should only be called once (for session-1)
      expect(mockComplete).toHaveBeenCalledTimes(1);

      // Verify the prompt contains only session-1 events
      const callArgs = mockComplete.mock.calls[0];
      const prompt = callArgs[0] as string;
      expect(prompt).toContain('/src/a.ts');
      expect(prompt).toContain('/src/b.ts');
      expect(prompt).toContain('/src/c.ts');
      expect(prompt).not.toContain('/src/d.ts');
      expect(prompt).not.toContain('/src/e.ts');
      expect(prompt).not.toContain('/src/f.ts');
    });

    test('should include timestamps in prompt', async () => {
      const mockComplete = vi.fn().mockResolvedValue({
        text: JSON.stringify([{ title: 'Test', content: 'Content' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      });
      mockLLMProvider.complete = mockComplete;

      const timestamp = 1234567890;
      // Add 3 events to meet threshold
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Read', { file_path: '/src/test.ts', lines: 100 });
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Bash', { command: 'ls', exitCode: 0 });
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Bash', { command: 'pwd', exitCode: 0 });

      // Manually set timestamp in database for all events
      db.prepare('UPDATE pending_events SET timestamp = ? WHERE session_id = ?').run(timestamp, 'test-session-123');

      const options: StopHookOptions = {
        provider: mockLLMProvider,
        sessionId: 'test-session-123',
        project: 'test-project',
      };

      await handleStop(db, options);

      // Verify prompt includes timestamp
      const callArgs = mockComplete.mock.calls[0];
      const prompt = callArgs[0] as string;
      expect(prompt).toContain('1234567890');
    });
  });

  describe('batching behavior', () => {
    test('should use default batch size of 15', async () => {
      const mockComplete = vi.fn().mockResolvedValue({
        text: JSON.stringify([{ title: 'Test', content: 'Content' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      });
      mockLLMProvider.complete = mockComplete;

      // Add 30 events (should create 2 batches of 15)
      for (let i = 0; i < 30; i++) {
        handlePostToolUse(db, 'test-session-123', 'test-project', 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }

      const options: StopHookOptions = {
        provider: mockLLMProvider,
        sessionId: 'test-session-123',
        project: 'test-project',
      };

      await handleStop(db, options);

      expect(mockComplete).toHaveBeenCalledTimes(2);
    });

    test('should allow custom batch size', async () => {
      const mockComplete = vi.fn().mockResolvedValue({
        text: JSON.stringify([{ title: 'Test', content: 'Content' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      });
      mockLLMProvider.complete = mockComplete;

      // Add 30 events with custom batch size of 10
      for (let i = 0; i < 30; i++) {
        handlePostToolUse(db, 'test-session-123', 'test-project', 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }

      const options: StopHookOptions = {
        provider: mockLLMProvider,
        sessionId: 'test-session-123',
        project: 'test-project',
        batchSize: 10,
      };

      await handleStop(db, options);

      expect(mockComplete).toHaveBeenCalledTimes(3);
    });

    test('should handle partial final batch', async () => {
      const mockComplete = vi.fn().mockResolvedValue({
        text: JSON.stringify([{ title: 'Test', content: 'Content' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      });
      mockLLMProvider.complete = mockComplete;

      // Add 17 events with batch size of 10 (should create 2 batches: 10 + 7)
      for (let i = 0; i < 17; i++) {
        handlePostToolUse(db, 'test-session-123', 'test-project', 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }

      const options: StopHookOptions = {
        provider: mockLLMProvider,
        sessionId: 'test-session-123',
        project: 'test-project',
        batchSize: 10,
      };

      await handleStop(db, options);

      expect(mockComplete).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration', () => {
    test('should create observations with embeddings', async () => {
      const mockComplete = vi.fn().mockResolvedValue({
        text: JSON.stringify([
          { title: 'Fixed critical bug', content: 'Resolved race condition in auth module' },
        ]),
        usage: { input_tokens: 100, output_tokens: 20 },
      });
      mockLLMProvider.complete = mockComplete;

      // Add realistic sequence of events
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Read', { file_path: '/src/auth.ts', lines: 150 });
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Grep', { pattern: 'race', path: '/src', count: 3 });
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Read', { file_path: '/src/auth/race.ts', lines: 50 });
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Edit', { file_path: '/src/auth/race.ts', old_string: 'let lock = false', new_string: 'let lock = true' });
      handlePostToolUse(db, 'test-session-123', 'test-project', 'Bash', { command: 'npm test', exitCode: 0 });

      const options: StopHookOptions = {
        provider: mockLLMProvider,
        sessionId: 'test-session-123',
        project: 'test-project',
      };

      await handleStop(db, options);

      const obs = getObservationV3(db, 1);
      expect(obs).not.toBeNull();
      expect(obs?.title).toBe('Fixed critical bug');
      expect(obs?.content).toBe('Resolved race condition in auth module');
      expect(obs?.project).toBe('test-project');
      expect(obs?.sessionId).toBe('test-session-123');
      expect(obs?.timestamp).toBeGreaterThan(0);
    });

    test('should handle multiple batches with context carryover', async () => {
      let callCount = 0;
      const mockComplete = vi.fn().mockImplementation(async () => {
        callCount++;
        const obs = callCount === 1
          ? [{ title: 'Batch 1 obs', content: 'From first batch' }]
          : [{ title: 'Batch 2 obs', content: 'From second batch' }];
        return {
          text: JSON.stringify(obs),
          usage: { input_tokens: 100, output_tokens: 20 },
        };
      });
      mockLLMProvider.complete = mockComplete;

      // Add 20 events for 2 batches
      for (let i = 0; i < 20; i++) {
        handlePostToolUse(db, 'test-session-123', 'test-project', 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }

      const options: StopHookOptions = {
        provider: mockLLMProvider,
        sessionId: 'test-session-123',
        project: 'test-project',
      };

      await handleStop(db, options);

      // Should create 2 observations (one from each batch)
      const obs1 = getObservationV3(db, 1);
      const obs2 = getObservationV3(db, 2);

      expect(obs1?.title).toBe('Batch 1 obs');
      expect(obs2?.title).toBe('Batch 2 obs');
    });
  });
});
