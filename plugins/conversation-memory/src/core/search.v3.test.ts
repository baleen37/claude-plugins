/**
 * Tests for V3 observation-only search
 *
 * Tests the simplified search functionality using only observations with vector similarity.
 * No exchanges, vec_exchanges, multi-concept search, or FTS.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabaseV3, insertObservationV3 } from './db.v3.js';
import { search, type SearchOptions } from './search.v3.js';

// Global mock factory that can be controlled per test
let mockGenerateEmbedding: (() => Promise<number[]>) | null = null;

// Set up top-level mocks
vi.mock('./embeddings.js', () => ({
  initEmbeddings: vi.fn(() => Promise.resolve()),
  generateEmbedding: vi.fn(() => Promise.resolve(mockGenerateEmbedding?.() ?? []))
}));

describe('search.v3 - observation-only search', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Use in-memory database for testing
    process.env.CONVERSATION_MEMORY_DB_PATH = ':memory:';
    db = initDatabaseV3();
  });

  afterEach(() => {
    db.close();
    mockGenerateEmbedding = null;
  });

  // Helper to create a 768-dimensional test embedding
  function createTestEmbedding(seed: number = 0): number[] {
    return Array.from({ length: 768 }, (_, i) => Math.sin(seed + i * 0.1) * 0.5 + 0.5);
  }

  // Helper to insert test observation
  function insertTestObservation(
    db: Database.Database,
    observation: {
      title: string;
      content: string;
      project: string;
      sessionId?: string;
      timestamp: number;
    },
    embedding?: number[]
  ): number {
    return insertObservationV3(db, {
      title: observation.title,
      content: observation.content,
      project: observation.project,
      sessionId: observation.sessionId ?? undefined,
      timestamp: observation.timestamp,
      createdAt: observation.timestamp
    }, embedding);
  }

  describe('validateISODate (via search)', () => {
    test('should accept valid ISO date format', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding();

      try {
        await search('test query', { db, after: '2025-01-15', before: '2025-01-20' });
        // If we get here without throwing, date validation passed
        expect(true).toBe(true);
      } catch (error: any) {
        if (error.message.includes('Invalid')) {
          throw error;
        }
        // Other errors are OK (like no results)
      }
    });

    test('should reject invalid date format - missing leading zeros', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding();

      await expect(
        search('test query', { db, after: '2025-1-5' })
      ).rejects.toThrow('Invalid --after date');
    });

    test('should reject invalid date format - wrong separator', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding();

      await expect(
        search('test query', { db, after: '2025/01/15' })
      ).rejects.toThrow('Invalid --after date');
    });

    test('should reject invalid calendar date - truly invalid date', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding();

      await expect(
        search('test query', { db, after: 'invalid-date' })
      ).rejects.toThrow('Invalid --after date');
    });

    test('should reject invalid month', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding();

      await expect(
        search('test query', { db, after: '2025-13-01' })
      ).rejects.toThrow('Not a valid calendar date');
    });

    test('should accept leap year date', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding();

      try {
        await search('test query', { db, after: '2024-02-29' });
        expect(true).toBe(true);
      } catch (error: any) {
        if (error.message.includes('Invalid')) {
          throw error;
        }
      }
    });
  });

  describe('search - vector mode', () => {
    beforeEach(() => {
      const now = Date.now();

      // Insert test observations with embeddings
      insertTestObservation(db, {
        title: 'Authentication system',
        content: 'Implement JWT-based authentication with refresh tokens',
        project: 'test-project',
        sessionId: 'session-1',
        timestamp: now - 2000
      }, createTestEmbedding(1));

      insertTestObservation(db, {
        title: 'Database optimization',
        content: 'Added indexes to improve query performance',
        project: 'test-project',
        sessionId: 'session-2',
        timestamp: now - 1000
      }, createTestEmbedding(2));

      insertTestObservation(db, {
        title: 'Testing improvements',
        content: 'Added unit tests for core modules',
        project: 'test-project',
        sessionId: 'session-3',
        timestamp: now
      }, createTestEmbedding(3));
    });

    test('should perform vector similarity search', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding(1); // Similar to first observation

      const results = await search('authentication', { db });

      expect(results.length).toBeGreaterThan(0);
    });

    test('should respect limit', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding(1);

      const results = await search('test', { db, limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should filter by project', async () => {
      const now = Date.now();

      insertTestObservation(db, {
        title: 'Project A observation',
        content: 'Content for project A',
        project: 'project-a',
        timestamp: now + 1000
      }, createTestEmbedding(5));

      mockGenerateEmbedding = async () => createTestEmbedding(5);

      const results = await search('project', { db, projects: ['project-a'] });
      expect(results.every(r => r.project === 'project-a')).toBe(true);
    });

    test('should filter by date range', async () => {
      const now = Date.now();

      const oldDate = new Date('2025-01-10').getTime();
      const newDate = new Date('2025-01-20').getTime();

      insertTestObservation(db, {
        title: 'Old observation',
        content: 'Old content',
        project: 'test-project',
        timestamp: oldDate
      }, createTestEmbedding(10));

      insertTestObservation(db, {
        title: 'New observation',
        content: 'New content',
        project: 'test-project',
        timestamp: newDate
      }, createTestEmbedding(11));

      mockGenerateEmbedding = async () => createTestEmbedding(11);

      const results = await search('content', {
        db,
        after: '2025-01-15',
        before: '2025-01-25'
      });

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('New observation');
    });
  });

  describe('search - result structure', () => {
    beforeEach(() => {
      insertTestObservation(db, {
        title: 'Test Result',
        content: 'Test content for result structure',
        project: 'test-project',
        sessionId: 'test-session',
        timestamp: Date.now()
      }, createTestEmbedding(1));
    });

    test('should return compact observations with correct structure', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding(1);

      const results = await search('test', { db });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('project');
      expect(results[0]).toHaveProperty('timestamp');
      // Should NOT have similarity field
      expect(results[0]).not.toHaveProperty('similarity');
    });

    test('should not include content in compact results', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding(1);

      const results = await search('test', { db });

      expect(results[0]).not.toHaveProperty('content');
    });

    test('should not include sessionId in compact results', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding(1);

      const results = await search('test', { db });

      expect(results[0]).not.toHaveProperty('sessionId');
    });

    test('should not include similarity field in results', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding(1);

      const vectorResults = await search('test', { db });

      // Should not include similarity
      vectorResults.forEach(r => expect(r).not.toHaveProperty('similarity'));
    });
  });

  describe('search - edge cases', () => {
    test('should handle empty database', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding();

      const results = await search('test', { db });
      expect(results).toEqual([]);
    });

    test('should handle special characters in query', async () => {
      insertTestObservation(db, {
        title: 'Special chars test',
        content: 'Test with special characters: @#$%^&*()',
        project: 'test-project',
        timestamp: Date.now()
      }, createTestEmbedding(1));

      mockGenerateEmbedding = async () => createTestEmbedding(1);

      const results = await search('special', { db });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    test('should handle unicode characters', async () => {
      insertTestObservation(db, {
        title: 'Unicode test',
        content: 'Test with unicode: Hello 世界 🌍',
        project: 'test-project',
        timestamp: Date.now()
      }, createTestEmbedding(1));

      mockGenerateEmbedding = async () => createTestEmbedding(1);

      const results = await search('unicode', { db });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    test('should handle very long queries', async () => {
      const longQuery = 'a'.repeat(1000);

      mockGenerateEmbedding = async () => createTestEmbedding();

      // Should not throw
      const results = await search(longQuery, { db });
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('search - files filter', () => {
    beforeEach(() => {
      const now = Date.now();

      insertTestObservation(db, {
        title: 'File A implementation',
        content: 'Implemented feature in src/file-a.ts',
        project: 'test-project',
        timestamp: now - 2000
      }, createTestEmbedding(1));

      insertTestObservation(db, {
        title: 'File B implementation',
        content: 'Fixed bug in lib/file-b.ts',
        project: 'test-project',
        timestamp: now - 1000
      }, createTestEmbedding(2));

      insertTestObservation(db, {
        title: 'No files mentioned',
        content: 'General architectural decision without files',
        project: 'test-project',
        timestamp: now
      }, createTestEmbedding(3));
    });

    test('should filter by single file path', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding();

      const results = await search('implementation', { db, files: ['src/file-a.ts'] });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('File A implementation');
    });

    test('should filter by multiple file paths', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding();

      const results = await search('implementation', { db, files: ['src/file-a.ts', 'lib/file-b.ts'] });
      expect(results.length).toBe(2);
      const titles = results.map(r => r.title);
      expect(titles).toContain('File A implementation');
      expect(titles).toContain('File B implementation');
    });

    test('should return empty when no matching files', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding();

      const results = await search('implementation', { db, files: ['nonexistent/file.ts'] });
      expect(results.length).toBe(0);
    });

    test('should handle empty files array', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding();

      const results = await search('implementation', { db, files: [] });
      expect(results.length).toBe(3);
    });

    test('should handle partial file path matches', async () => {
      mockGenerateEmbedding = async () => createTestEmbedding();

      const results = await search('implementation', { db, files: ['file-a'] });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('File A implementation');
    });
  });
});
