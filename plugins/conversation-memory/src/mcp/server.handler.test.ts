/**
 * MCP Server Handler Tests
 *
 * Tests for the exported handler functions in server.ts.
 * These tests execute the actual handler code with mocked dependencies.
 *
 * Coverage:
 * 1. handleSearch - Tests search params handling and result formatting
 * 2. handleGetObservations - Tests ID conversion and observation retrieval
 * 3. handleRead - Tests file reading and pagination
 * 4. handleError - Tests error formatting
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';

// Mock the search function - factory must define mock inline
vi.mock('../core/search.v3.js', () => ({
  search: vi.fn(),
}));

// Mock the observations function
vi.mock('../core/observations.v3.js', () => ({
  findByIds: vi.fn(),
}));

// Mock the read function
vi.mock('../core/read.js', () => ({
  readConversation: vi.fn(),
}));

// Import handlers AFTER mocking
import {
  handleSearch,
  handleGetObservations,
  handleRead,
  handleError,
  SearchInputSchema,
  GetObservationsInputSchema,
  ReadInputSchema,
} from './server.js';

// Import mocked modules to get typed mock functions
import { search as mockSearch } from '../core/search.v3.js';
import { findByIds as mockFindByIds } from '../core/observations.v3.js';
import { readConversation as mockReadConversation } from '../core/read.js';

describe('MCP Server Handlers', () => {
  let mockDb: Database.Database;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a mock database
    mockDb = {} as Database.Database;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('handleSearch', () => {
    test('returns SearchResult[] with valid params', async () => {
      vi.mocked(mockSearch).mockResolvedValueOnce([
        { id: 1, title: 'Test Result', project: 'test-project', timestamp: 1234567890 },
        { id: 2, title: 'Another Result', project: 'test-project', timestamp: 1234567900 },
      ]);

      const params = SearchInputSchema.parse({
        query: 'test query',
        limit: 10,
      });

      const results = await handleSearch(params, mockDb);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: '1',
        title: 'Test Result',
        project: 'test-project',
        timestamp: 1234567890,
      });
      expect(results[1]).toEqual({
        id: '2',
        title: 'Another Result',
        project: 'test-project',
        timestamp: 1234567900,
      });
    });

    test('passes params correctly to search function', async () => {
      vi.mocked(mockSearch).mockResolvedValueOnce([]);

      const params = SearchInputSchema.parse({
        query: 'search term',
        limit: 25,
        after: '2024-01-01',
        before: '2024-12-31',
        projects: ['project-a', 'project-b'],
        files: ['/path/to/file.ts'],
      });

      await handleSearch(params, mockDb);

      expect(mockSearch).toHaveBeenCalledWith('search term', {
        db: mockDb,
        limit: 25,
        after: '2024-01-01',
        before: '2024-12-31',
        projects: ['project-a', 'project-b'],
        files: ['/path/to/file.ts'],
      });
    });

    test('formats results with id as string', async () => {
      vi.mocked(mockSearch).mockResolvedValueOnce([
        { id: 999, title: 'Numeric ID', project: 'p', timestamp: 1 },
      ]);

      const params = SearchInputSchema.parse({ query: 'test' });
      const results = await handleSearch(params, mockDb);

      expect(results[0].id).toBe('999');
      expect(typeof results[0].id).toBe('string');
    });

    test('returns empty array when no results', async () => {
      vi.mocked(mockSearch).mockResolvedValueOnce([]);

      const params = SearchInputSchema.parse({ query: 'nonexistent' });
      const results = await handleSearch(params, mockDb);

      expect(results).toEqual([]);
    });

    test('handles optional params (after, before)', async () => {
      vi.mocked(mockSearch).mockResolvedValueOnce([]);

      const params = SearchInputSchema.parse({
        query: 'test',
        after: '2024-06-01',
      });

      await handleSearch(params, mockDb);

      expect(mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
        after: '2024-06-01',
        before: undefined,
      }));
    });

    test('handles optional params (projects, files)', async () => {
      vi.mocked(mockSearch).mockResolvedValueOnce([]);

      const params = SearchInputSchema.parse({
        query: 'test',
        projects: ['my-project'],
        files: ['/src/index.ts'],
      });

      await handleSearch(params, mockDb);

      expect(mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
        projects: ['my-project'],
        files: ['/src/index.ts'],
      }));
    });

    test('uses default limit when not specified', async () => {
      vi.mocked(mockSearch).mockResolvedValueOnce([]);

      const params = SearchInputSchema.parse({ query: 'test' });
      await handleSearch(params, mockDb);

      expect(mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
        limit: 10,
      }));
    });
  });

  describe('handleGetObservations', () => {
    test('converts string IDs to numbers', async () => {
      vi.mocked(mockFindByIds).mockResolvedValueOnce([
        { id: 1, title: 'Obs 1', content: 'Content 1', project: 'p', sessionId: null, timestamp: 1000 },
      ]);

      const params = GetObservationsInputSchema.parse({ ids: ['1', '2'] });
      const results = await handleGetObservations(params, mockDb);

      expect(mockFindByIds).toHaveBeenCalledWith(mockDb, [1, 2]);
      expect(results).toHaveLength(1);
    });

    test('handles numeric IDs directly', async () => {
      vi.mocked(mockFindByIds).mockResolvedValueOnce([
        { id: 10, title: 'Obs 10', content: 'Content 10', project: 'p', sessionId: null, timestamp: 2000 },
        { id: 20, title: 'Obs 20', content: 'Content 20', project: 'p', sessionId: null, timestamp: 3000 },
      ]);

      const params = GetObservationsInputSchema.parse({ ids: [10, 20] });
      const results = await handleGetObservations(params, mockDb);

      expect(mockFindByIds).toHaveBeenCalledWith(mockDb, [10, 20]);
      expect(results).toHaveLength(2);
    });

    test('handles mixed string/number IDs', async () => {
      vi.mocked(mockFindByIds).mockResolvedValueOnce([
        { id: 1, title: 'Obs', content: 'C', project: 'p', sessionId: null, timestamp: 1000 },
      ]);

      const params = GetObservationsInputSchema.parse({ ids: ['1', 2, '3'] });
      await handleGetObservations(params, mockDb);

      expect(mockFindByIds).toHaveBeenCalledWith(mockDb, [1, 2, 3]);
    });

    test('returns observation objects with correct fields', async () => {
      vi.mocked(mockFindByIds).mockResolvedValueOnce([
        {
          id: 42,
          title: 'Test Observation',
          content: 'Full content here',
          project: 'my-project',
          sessionId: 'session-123',
          timestamp: 1704067200000,
        },
      ]);

      const params = GetObservationsInputSchema.parse({ ids: [42] });
      const results = await handleGetObservations(params, mockDb);

      expect(results[0]).toEqual({
        id: 42,
        title: 'Test Observation',
        content: 'Full content here',
        project: 'my-project',
        timestamp: 1704067200000,
      });
    });

    test('returns empty results when no observations found', async () => {
      vi.mocked(mockFindByIds).mockResolvedValueOnce([]);

      const params = GetObservationsInputSchema.parse({ ids: [999] });
      const results = await handleGetObservations(params, mockDb);

      expect(results).toEqual([]);
    });

    test('handles multiple observations', async () => {
      vi.mocked(mockFindByIds).mockResolvedValueOnce([
        { id: 1, title: 'First', content: 'C1', project: 'p1', sessionId: null, timestamp: 1000 },
        { id: 2, title: 'Second', content: 'C2', project: 'p2', sessionId: null, timestamp: 2000 },
        { id: 3, title: 'Third', content: 'C3', project: 'p3', sessionId: null, timestamp: 3000 },
      ]);

      const params = GetObservationsInputSchema.parse({ ids: [1, 2, 3] });
      const results = await handleGetObservations(params, mockDb);

      expect(results).toHaveLength(3);
      expect(results.map(r => r.id)).toEqual([1, 2, 3]);
    });
  });

  describe('handleRead', () => {
    test('returns content for valid path', () => {
      vi.mocked(mockReadConversation).mockReturnValueOnce('# Conversation\n\nTest content');

      const params = ReadInputSchema.parse({ path: '/valid/path.jsonl' });
      const result = handleRead(params);

      expect(result).toBe('# Conversation\n\nTest content');
      expect(mockReadConversation).toHaveBeenCalledWith('/valid/path.jsonl', undefined, undefined);
    });

    test('passes pagination params (startLine, endLine)', () => {
      vi.mocked(mockReadConversation).mockReturnValueOnce('# Page content');

      const params = ReadInputSchema.parse({
        path: '/file.jsonl',
        startLine: 10,
        endLine: 50,
      });
      const result = handleRead(params);

      expect(mockReadConversation).toHaveBeenCalledWith('/file.jsonl', 10, 50);
      expect(result).toBe('# Page content');
    });

    test('throws error when file not found', () => {
      vi.mocked(mockReadConversation).mockReturnValueOnce(null);

      const params = ReadInputSchema.parse({ path: '/nonexistent.jsonl' });

      expect(() => handleRead(params)).toThrow('File not found: /nonexistent.jsonl');
    });

    test('handles startLine only', () => {
      vi.mocked(mockReadConversation).mockReturnValueOnce('# From line 10');

      const params = ReadInputSchema.parse({
        path: '/file.jsonl',
        startLine: 10,
      });
      handleRead(params);

      expect(mockReadConversation).toHaveBeenCalledWith('/file.jsonl', 10, undefined);
    });

    test('handles endLine only', () => {
      vi.mocked(mockReadConversation).mockReturnValueOnce('# Until line 50');

      const params = ReadInputSchema.parse({
        path: '/file.jsonl',
        endLine: 50,
      });
      handleRead(params);

      expect(mockReadConversation).toHaveBeenCalledWith('/file.jsonl', undefined, 50);
    });

    test('propagates empty string result', () => {
      vi.mocked(mockReadConversation).mockReturnValueOnce('');

      const params = ReadInputSchema.parse({ path: '/empty.jsonl' });
      const result = handleRead(params);

      expect(result).toBe('');
    });
  });

  describe('handleError', () => {
    test('formats Error instance', () => {
      const error = new Error('Something went wrong');
      const result = handleError(error);

      expect(result).toBe('Error: Something went wrong');
    });

    test('formats string error', () => {
      const result = handleError('Simple error message');

      expect(result).toBe('Error: Simple error message');
    });

    test('formats number error', () => {
      const result = handleError(404);

      expect(result).toBe('Error: 404');
    });

    test('formats object error', () => {
      const result = handleError({ code: 'ERR_INVALID' });

      expect(result).toBe('Error: [object Object]');
    });

    test('formats null error', () => {
      const result = handleError(null);

      expect(result).toBe('Error: null');
    });

    test('formats undefined error', () => {
      const result = handleError(undefined);

      expect(result).toBe('Error: undefined');
    });

    test('formats array error', () => {
      const result = handleError(['error1', 'error2']);

      expect(result).toBe('Error: error1,error2');
    });

    test('preserves Error message with colon', () => {
      const error = new Error('Validation failed: field is required');
      const result = handleError(error);

      expect(result).toBe('Error: Validation failed: field is required');
    });
  });
});
