/**
 * Integration Tests for V3 Architecture
 *
 * Comprehensive tests for the complete workflow:
 * 1. PostToolUse → pending_events → Stop → observations (E2E workflow)
 * 2. SessionStart hook injection workflow
 * 3. MCP tools work with V3 database
 * 4. Full workflow from tool event to observation to search/injection
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabaseV3, getPendingEventsV3, getObservationV3, getObservationCountV3 } from './core/db.v3.js';
import { handlePostToolUse } from './hooks/post-tool-use.js';
import { handleStop, type StopHookOptions } from './hooks/stop.js';
import { handleSessionStart, type SessionStartConfig } from './hooks/session-start.js';
import { search as searchV3 } from './core/search.v3.js';
import { findByIds as getObservationsByIds } from './core/observations.v3.js';
import type { LLMProvider } from './core/llm/index.js';

// Mock LLM provider
const createMockLLMProvider = (responses: Array<{ text: string; usage?: { input_tokens: number; output_tokens: number } }>) => {
  let callCount = 0;
  const mockComplete = vi.fn(async () => {
    const response = responses[Math.min(callCount, responses.length - 1)];
    callCount++;
    return response;
  });
  return {
    complete: mockComplete,
    __mockFn: mockComplete, // Expose mock function for testing
  } as unknown as LLMProvider & { __mockFn: ReturnType<typeof vi.fn> };
};

// Mock embeddings module
vi.mock('./core/embeddings.js', () => ({
  initEmbeddings: vi.fn().mockResolvedValue(undefined),
  generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
}));

describe('V3 Integration Tests', () => {
  let db: Database.Database;

  beforeEach(() => {
    process.env.CONVERSATION_MEMORY_DB_PATH = ':memory:';
    db = initDatabaseV3();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('End-to-End Workflow: PostToolUse → pending_events → Stop → observations', () => {
    test('complete workflow from tool events to observations', async () => {
      // Step 1: Simulate multiple tool uses during a session
      const sessionId = 'test-session-e2e';
      const project = 'test-project';

      // User asks Claude to implement a feature
      handlePostToolUse(db, sessionId, project, 'Read', { file_path: '/src/auth.ts', lines: 150 });
      handlePostToolUse(db, sessionId, project, 'Grep', { pattern: 'login', path: '/src', count: 5 });
      handlePostToolUse(db, sessionId, project, 'Read', { file_path: '/src/login.ts', lines: 80 });
      handlePostToolUse(db, sessionId, project, 'Edit', {
        file_path: '/src/auth.ts',
        old_string: 'function login()',
        new_string: 'async function login()'
      });
      handlePostToolUse(db, sessionId, project, 'Bash', { command: 'npm test', exitCode: 0 });
      handlePostToolUse(db, sessionId, project, 'Bash', { command: 'npm run lint', exitCode: 1, stderr: 'Error: Unused variable' });

      // Step 2: Verify pending_events were stored
      const pendingEvents = getPendingEventsV3(db, sessionId, 100);
      expect(pendingEvents).toHaveLength(6);
      expect(pendingEvents[0].toolName).toBe('Read');
      expect(pendingEvents[0].project).toBe(project);
      expect(pendingEvents[5].toolName).toBe('Bash');

      // Step 3: Trigger Stop hook to extract observations
      const mockProvider = createMockLLMProvider([{
        text: JSON.stringify([
          { title: 'Fixed async auth bug', content: 'Changed login function to async in auth.ts to properly handle JWT promises' },
          { title: 'Added login route', content: 'Implemented new login route with JWT authentication' },
        ]),
        usage: { input_tokens: 150, output_tokens: 30 },
      }]);

      const stopOptions: StopHookOptions = {
        provider: mockProvider,
        sessionId,
        project,
      };

      await handleStop(db, stopOptions);

      // Step 4: Verify observations were created
      const obs1 = getObservationV3(db, 1);
      const obs2 = getObservationV3(db, 2);

      expect(obs1).not.toBeNull();
      expect(obs1?.title).toBe('Fixed async auth bug');
      expect(obs1?.project).toBe(project);
      expect(obs1?.sessionId).toBe(sessionId);

      expect(obs2).not.toBeNull();
      expect(obs2?.title).toBe('Added login route');
      expect(obs2?.project).toBe(project);

      // Step 5: Verify LLM was called with correct context
      expect(mockProvider.__mockFn).toHaveBeenCalledTimes(1);
      const callArgs = mockProvider.__mockFn.mock.calls[0];
      const prompt = callArgs[0] as string;
      expect(prompt).toContain('/src/auth.ts');
      expect(prompt).toContain('/src/login.ts');
      expect(prompt).toContain('async function login()');
    });

    test('workflow handles batches correctly', async () => {
      const sessionId = 'test-session-batches';
      const project = 'test-project';

      // Add 20 events (should create 2 batches with default batch size of 15)
      for (let i = 0; i < 20; i++) {
        handlePostToolUse(db, sessionId, project, 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }

      const mockProvider = createMockLLMProvider([
        {
          text: JSON.stringify([
            { title: 'Batch 1 obs', content: 'From first batch' },
          ]),
          usage: { input_tokens: 150, output_tokens: 20 },
        },
        {
          text: JSON.stringify([
            { title: 'Batch 2 obs', content: 'From second batch' },
          ]),
          usage: { input_tokens: 100, output_tokens: 20 },
        },
      ]);

      const stopOptions: StopHookOptions = {
        provider: mockProvider,
        sessionId,
        project,
      };

      await handleStop(db, stopOptions);

      // Should have called LLM twice (2 batches)
      expect(mockProvider.complete).toHaveBeenCalledTimes(2);

      // Should have created 2 observations
      const obs1 = getObservationV3(db, 1);
      const obs2 = getObservationV3(db, 2);

      expect(obs1?.title).toBe('Batch 1 obs');
      expect(obs2?.title).toBe('Batch 2 obs');
    });

    test('workflow skips extraction when below threshold', async () => {
      const sessionId = 'test-session-threshold';
      const project = 'test-project';

      // Add only 2 events (below minimum threshold of 3)
      handlePostToolUse(db, sessionId, project, 'Read', { file_path: '/src/test.ts', lines: 100 });
      handlePostToolUse(db, sessionId, project, 'Bash', { command: 'ls', exitCode: 0 });

      const mockProvider = createMockLLMProvider([{
        text: JSON.stringify([{ title: 'Test', content: 'Content' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      }]);

      const stopOptions: StopHookOptions = {
        provider: mockProvider,
        sessionId,
        project,
      };

      await handleStop(db, stopOptions);

      // LLM should not be called
      expect(mockProvider.complete).not.toHaveBeenCalled();

      // No observations should be created
      const obs = getObservationV3(db, 1);
      expect(obs).toBeNull();
    });

    test('workflow filters out low-value tools', async () => {
      const sessionId = 'test-session-filter';
      const project = 'test-project';

      // Mix of valuable and low-value tools
      handlePostToolUse(db, sessionId, project, 'Read', { file_path: '/src/test.ts', lines: 100 });
      handlePostToolUse(db, sessionId, project, 'Glob', { pattern: '*.ts' }); // Should be filtered
      handlePostToolUse(db, sessionId, project, 'Bash', { command: 'npm test', exitCode: 0 });
      handlePostToolUse(db, sessionId, project, 'LSP', { operation: 'goToDefinition' }); // Should be filtered

      // Only Read and Bash should be in pending_events
      const pendingEvents = getPendingEventsV3(db, sessionId, 100);
      expect(pendingEvents).toHaveLength(2);
      expect(pendingEvents[0].toolName).toBe('Read');
      expect(pendingEvents[1].toolName).toBe('Bash');
    });
  });

  describe('SessionStart Hook Injection Workflow', () => {
    test('injects recent observations at session start', async () => {
      const project = 'test-project';

      // Create some observations from a previous session
      const mockProvider = createMockLLMProvider([{
        text: JSON.stringify([
          { title: 'Fixed auth bug', content: 'Resolved JWT validation issue' },
          { title: 'Added rate limiting', content: 'Implemented Redis-backed rate limiting' },
          { title: 'Updated tests', content: 'Increased test coverage to 85%' },
        ]),
        usage: { input_tokens: 150, output_tokens: 40 },
      }]);

      const stopOptions: StopHookOptions = {
        provider: mockProvider,
        sessionId: 'previous-session',
        project,
      };

      // Add events and create observations
      for (let i = 0; i < 5; i++) {
        handlePostToolUse(db, 'previous-session', project, 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }
      await handleStop(db, stopOptions);

      // Now start a new session
      const config: SessionStartConfig = {
        maxObservations: 10,
        maxTokens: 500,
        recencyDays: 7,
        projectOnly: true,
      };

      const result = await handleSessionStart(db, project, config);

      // Should inject observations
      expect(result.markdown).toContain('# test-project recent context (conversation-memory)');
      expect(result.markdown).toContain('- Fixed auth bug: Resolved JWT validation issue');
      expect(result.markdown).toContain('- Added rate limiting: Implemented Redis-backed rate limiting');
      expect(result.markdown).toContain('- Updated tests: Increased test coverage to 85%');
      expect(result.includedCount).toBe(3);
    });

    test('respects token budget during injection', async () => {
      const project = 'test-project';

      // Create observations with varying content lengths
      const mockProvider = createMockLLMProvider([{
        text: JSON.stringify([
          { title: 'Short', content: 'A' },
          { title: 'Medium', content: 'This is medium length content' },
          { title: 'Long', content: 'This is very long content that would exceed the token budget if included '.repeat(10) },
        ]),
        usage: { input_tokens: 150, output_tokens: 40 },
      }]);

      const stopOptions: StopHookOptions = {
        provider: mockProvider,
        sessionId: 'previous-session',
        project,
      };

      for (let i = 0; i < 5; i++) {
        handlePostToolUse(db, 'previous-session', project, 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }
      await handleStop(db, stopOptions);

      // Now start a new session with small token budget
      const config: SessionStartConfig = {
        maxObservations: 10,
        maxTokens: 50, // Very small budget
        recencyDays: 7,
        projectOnly: true,
      };

      const result = await handleSessionStart(db, project, config);

      // Should stop before exceeding budget
      expect(result.tokenCount).toBeLessThanOrEqual(50);
      expect(result.includedCount).toBeGreaterThan(0);
    });

    test('filters by recency days', async () => {
      const project = 'test-project';
      const now = Date.now();
      const dayInMs = 24 * 60 * 60 * 1000;

      // Create old observation
      const oldMockProvider = createMockLLMProvider([{
        text: JSON.stringify([{ title: 'Old observation', content: 'From 10 days ago' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      }]);

      for (let i = 0; i < 3; i++) {
        handlePostToolUse(db, 'old-session', project, 'Read', { file_path: `/src/old${i}.ts`, lines: 100 });
      }
      await handleStop(db, {
        provider: oldMockProvider,
        sessionId: 'old-session',
        project,
      });

      // Manually set old timestamp
      db.prepare('UPDATE observations SET timestamp = ?, created_at = ? WHERE id = 1')
        .run(now - 10 * dayInMs, now - 10 * dayInMs);

      // Create recent observation
      const recentMockProvider = createMockLLMProvider([{
        text: JSON.stringify([{ title: 'Recent observation', content: 'From today' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      }]);

      for (let i = 0; i < 3; i++) {
        handlePostToolUse(db, 'recent-session', project, 'Read', { file_path: `/src/recent${i}.ts`, lines: 100 });
      }
      await handleStop(db, {
        provider: recentMockProvider,
        sessionId: 'recent-session',
        project,
      });

      // Now start session with 7-day recency filter
      const config: SessionStartConfig = {
        maxObservations: 10,
        maxTokens: 500,
        recencyDays: 7,
        projectOnly: true,
      };

      const result = await handleSessionStart(db, project, config);

      // Should only include recent observation
      expect(result.markdown).toContain('Recent observation');
      expect(result.markdown).not.toContain('Old observation');
      expect(result.includedCount).toBe(1);
    });
  });

  describe('MCP Tools Integration', () => {
    test('search tool returns compact observations', async () => {
      const project = 'test-project';

      // Create some observations
      const mockProvider = createMockLLMProvider([{
        text: JSON.stringify([
          { title: 'Fixed authentication', content: 'Resolved JWT validation issue in login flow' },
          { title: 'Added caching', content: 'Implemented Redis caching for API responses' },
        ]),
        usage: { input_tokens: 150, output_tokens: 30 },
      }]);

      for (let i = 0; i < 5; i++) {
        handlePostToolUse(db, 'session-1', project, 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }
      await handleStop(db, {
        provider: mockProvider,
        sessionId: 'session-1',
        project,
      });

      // Search for observations
      const results = await searchV3('authentication', {
        db,
        limit: 10,
      });

      // Should return compact results
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('project');
      expect(results[0]).toHaveProperty('timestamp');
      expect(results[0]).not.toHaveProperty('content'); // Compact result
    });

    test('get_observations retrieves full details', async () => {
      const project = 'test-project';

      // Create an observation
      const mockProvider = createMockLLMProvider([{
        text: JSON.stringify([
          { title: 'Fixed auth bug', content: 'Resolved JWT validation issue in login flow' },
        ]),
        usage: { input_tokens: 150, output_tokens: 20 },
      }]);

      for (let i = 0; i < 3; i++) {
        handlePostToolUse(db, 'session-1', project, 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }
      await handleStop(db, {
        provider: mockProvider,
        sessionId: 'session-1',
        project,
      });

      // Get full observation details
      const observations = await getObservationsByIds(db, [1]);

      expect(observations).toHaveLength(1);
      expect(observations[0]).toHaveProperty('id');
      expect(observations[0]).toHaveProperty('title');
      expect(observations[0]).toHaveProperty('content'); // Full details
      expect(observations[0].title).toBe('Fixed auth bug');
      expect(observations[0].content).toBe('Resolved JWT validation issue in login flow');
    });

    test('search with project filter', async () => {
      // Create observations for different projects
      const mockProvider1 = createMockLLMProvider([{
        text: JSON.stringify([{ title: 'Project A feature', content: 'Added feature to project A' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      }]);

      for (let i = 0; i < 3; i++) {
        handlePostToolUse(db, 'session-1', 'project-a', 'Read', { file_path: `/src/a${i}.ts`, lines: 100 });
      }
      await handleStop(db, {
        provider: mockProvider1,
        sessionId: 'session-1',
        project: 'project-a',
      });

      const mockProvider2 = createMockLLMProvider([{
        text: JSON.stringify([{ title: 'Project B feature', content: 'Added feature to project B' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      }]);

      for (let i = 0; i < 3; i++) {
        handlePostToolUse(db, 'session-2', 'project-b', 'Read', { file_path: `/src/b${i}.ts`, lines: 100 });
      }
      await handleStop(db, {
        provider: mockProvider2,
        sessionId: 'session-2',
        project: 'project-b',
      });

      // Search with project filter
      const results = await searchV3('feature', {
        db,
        limit: 10,
        projects: ['project-a'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].project).toBe('project-a');
    });

    test('search with date range filter', async () => {
      const project = 'test-project';
      const now = Date.now();
      const dayInMs = 24 * 60 * 60 * 1000;

      // Create observation with specific timestamp
      const mockProvider = createMockLLMProvider([{
        text: JSON.stringify([{ title: 'Test observation', content: 'Test content' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      }]);

      for (let i = 0; i < 3; i++) {
        handlePostToolUse(db, 'session-1', project, 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }
      await handleStop(db, {
        provider: mockProvider,
        sessionId: 'session-1',
        project,
      });

      // Manually set timestamp to 5 days ago
      const fiveDaysAgo = now - 5 * dayInMs;
      db.prepare('UPDATE observations SET timestamp = ?, created_at = ? WHERE id = 1')
        .run(fiveDaysAgo, fiveDaysAgo);

      // Search with date filter
      const afterDate = new Date(now - 7 * dayInMs).toISOString().split('T')[0];
      const beforeDate = new Date(now - 3 * dayInMs).toISOString().split('T')[0];

      const results = await searchV3('observation', {
        db,
        limit: 10,
        after: afterDate,
        before: beforeDate,
      });

      // Should find the observation from 5 days ago
      expect(results).toHaveLength(1);
    });

    test('search with files filter', async () => {
      const project = 'test-project';

      // Create observation mentioning specific files
      const mockProvider = createMockLLMProvider([{
        text: JSON.stringify([
          {
            title: 'Fixed auth.ts',
            content: 'Resolved race condition in /src/auth.ts and updated /src/login.ts'
          },
        ]),
        usage: { input_tokens: 100, output_tokens: 20 },
      }]);

      for (let i = 0; i < 3; i++) {
        handlePostToolUse(db, 'session-1', project, 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }
      await handleStop(db, {
        provider: mockProvider,
        sessionId: 'session-1',
        project,
      });

      // Search with files filter
      const results = await searchV3('auth', {
        db,
        limit: 10,
        files: ['/src/auth.ts'],
      });

      expect(results).toHaveLength(1);
    });
  });

  describe('Full Workflow Integration', () => {
    test('complete lifecycle: events → observations → injection', async () => {
      const project = 'test-project';
      const sessionId1 = 'session-day-1';
      const sessionId2 = 'session-day-2';

      // Day 1: Work on authentication feature
      handlePostToolUse(db, sessionId1, project, 'Read', { file_path: '/src/auth.ts', lines: 200 });
      handlePostToolUse(db, sessionId1, project, 'Grep', { pattern: 'JWT', path: '/src', count: 3 });
      handlePostToolUse(db, sessionId1, project, 'Read', { file_path: '/src/jwt.ts', lines: 100 });
      handlePostToolUse(db, sessionId1, project, 'Edit', {
        file_path: '/src/auth.ts',
        old_string: 'function verify(token)',
        new_string: 'async function verify(token)'
      });
      handlePostToolUse(db, sessionId1, project, 'Bash', { command: 'npm test auth', exitCode: 0 });
      handlePostToolUse(db, sessionId1, project, 'Bash', { command: 'npm run build', exitCode: 0 });

      // Extract observations from Day 1
      const mockProvider1 = createMockLLMProvider([{
        text: JSON.stringify([
          { title: 'Made verify async', content: 'Changed JWT verification to async in auth.ts to properly handle token validation promises' },
          { title: 'Added auth tests', content: 'Created comprehensive test suite for JWT verification including edge cases' },
        ]),
        usage: { input_tokens: 200, output_tokens: 40 },
      }]);

      await handleStop(db, {
        provider: mockProvider1,
        sessionId: sessionId1,
        project,
      });

      // Verify observations from Day 1
      const obsCountAfterDay1 = getObservationCountV3(db, project);
      expect(obsCountAfterDay1).toBe(2);

      // Day 2: Start new session (should inject previous observations)
      const config: SessionStartConfig = {
        maxObservations: 10,
        maxTokens: 500,
        recencyDays: 7,
        projectOnly: true,
      };

      const sessionStartResult = await handleSessionStart(db, project, config);

      // Should inject previous observations
      expect(sessionStartResult.markdown).toContain('Made verify async');
      expect(sessionStartResult.markdown).toContain('Added auth tests');
      expect(sessionStartResult.includedCount).toBe(2);

      // Continue working on Day 2
      handlePostToolUse(db, sessionId2, project, 'Read', { file_path: '/src/auth.ts', lines: 200 });
      handlePostToolUse(db, sessionId2, project, 'Edit', {
        file_path: '/src/auth.ts',
        old_string: 'async function verify(token)',
        new_string: 'async function verify(token, options = {})'
      });
      handlePostToolUse(db, sessionId2, project, 'Bash', { command: 'npm test auth', exitCode: 0 });

      // Extract observations from Day 2
      const mockProvider2 = createMockLLMProvider([{
        text: JSON.stringify([
          { title: 'Added verify options', content: 'Added optional parameter to JWT verify function for custom validation options' },
        ]),
        usage: { input_tokens: 150, output_tokens: 20 },
      }]);

      await handleStop(db, {
        provider: mockProvider2,
        sessionId: sessionId2,
        project,
      });

      // Verify all observations
      const obsCountAfterDay2 = getObservationCountV3(db, project);
      expect(obsCountAfterDay2).toBe(3);

      // Search should find all related observations
      const searchResults = await searchV3('auth verify', {
        db,
        limit: 10,
      });

      expect(searchResults).toHaveLength(3);
    });

    test('multiple projects do not interfere', async () => {
      // Project A: Work on auth
      const mockProviderA = createMockLLMProvider([{
        text: JSON.stringify([{ title: 'Fixed auth', content: 'Auth fix for project A' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      }]);

      for (let i = 0; i < 3; i++) {
        handlePostToolUse(db, 'session-a', 'project-a', 'Read', { file_path: `/src/a${i}.ts`, lines: 100 });
      }
      await handleStop(db, {
        provider: mockProviderA,
        sessionId: 'session-a',
        project: 'project-a',
      });

      // Project B: Work on UI
      const mockProviderB = createMockLLMProvider([{
        text: JSON.stringify([{ title: 'Fixed UI', content: 'UI fix for project B' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      }]);

      for (let i = 0; i < 3; i++) {
        handlePostToolUse(db, 'session-b', 'project-b', 'Read', { file_path: `/src/b${i}.ts`, lines: 100 });
      }
      await handleStop(db, {
        provider: mockProviderB,
        sessionId: 'session-b',
        project: 'project-b',
      });

      // Verify isolation
      expect(getObservationCountV3(db, 'project-a')).toBe(1);
      expect(getObservationCountV3(db, 'project-b')).toBe(1);

      // Search should respect project filter
      const resultsA = await searchV3('fix', {
        db,
        limit: 10,
        projects: ['project-a'],
      });

      const resultsB = await searchV3('fix', {
        db,
        limit: 10,
        projects: ['project-b'],
      });

      expect(resultsA).toHaveLength(1);
      expect(resultsA[0].project).toBe('project-a');
      expect(resultsB).toHaveLength(1);
      expect(resultsB[0].project).toBe('project-b');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles LLM errors gracefully', async () => {
      const mockProvider = {
        complete: vi.fn().mockRejectedValue(new Error('API rate limit exceeded')),
      } as unknown as LLMProvider;

      for (let i = 0; i < 3; i++) {
        handlePostToolUse(db, 'session-error', 'test-project', 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }

      // Should not throw
      await expect(handleStop(db, {
        provider: mockProvider,
        sessionId: 'session-error',
        project: 'test-project',
      })).resolves.toBeUndefined();

      // No observations should be created
      expect(getObservationCountV3(db, 'test-project')).toBe(0);
    });

    test('handles empty LLM response', async () => {
      const mockProvider = createMockLLMProvider([{
        text: JSON.stringify([]), // Empty array
        usage: { input_tokens: 100, output_tokens: 5 },
      }]);

      for (let i = 0; i < 3; i++) {
        handlePostToolUse(db, 'session-empty', 'test-project', 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }

      await handleStop(db, {
        provider: mockProvider,
        sessionId: 'session-empty',
        project: 'test-project',
      });

      // LLM should be called but no observations created
      expect(mockProvider.complete).toHaveBeenCalledTimes(1);
      expect(getObservationCountV3(db, 'test-project')).toBe(0);
    });

    test('handles malformed LLM response', async () => {
      const mockProvider = createMockLLMProvider([{
        text: 'invalid json{',
        usage: { input_tokens: 100, output_tokens: 10 },
      }]);

      for (let i = 0; i < 3; i++) {
        handlePostToolUse(db, 'session-malformed', 'test-project', 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }

      // Should not throw
      await expect(handleStop(db, {
        provider: mockProvider,
        sessionId: 'session-malformed',
        project: 'test-project',
      })).resolves.toBeUndefined();

      // No observations should be created
      expect(getObservationCountV3(db, 'test-project')).toBe(0);
    });

    test('handles concurrent sessions', async () => {
      // Simulate two sessions running concurrently
      for (let i = 0; i < 3; i++) {
        handlePostToolUse(db, 'session-1', 'test-project', 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
        handlePostToolUse(db, 'session-2', 'test-project', 'Read', { file_path: `/src/file${i}.ts`, lines: 100 });
      }

      // Process sessions independently
      const mockProvider1 = createMockLLMProvider([{
        text: JSON.stringify([{ title: 'Session 1 obs', content: 'From session 1' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      }]);

      const mockProvider2 = createMockLLMProvider([{
        text: JSON.stringify([{ title: 'Session 2 obs', content: 'From session 2' }]),
        usage: { input_tokens: 100, output_tokens: 20 },
      }]);

      await Promise.all([
        handleStop(db, { provider: mockProvider1, sessionId: 'session-1', project: 'test-project' }),
        handleStop(db, { provider: mockProvider2, sessionId: 'session-2', project: 'test-project' }),
      ]);

      // Both observations should be created
      expect(getObservationCountV3(db, 'test-project')).toBe(2);

      const obs1 = getObservationV3(db, 1);
      const obs2 = getObservationV3(db, 2);

      expect(obs1?.sessionId).toBe('session-1');
      expect(obs2?.sessionId).toBe('session-2');
    });
  });
});
