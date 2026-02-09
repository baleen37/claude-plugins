/**
 * Tests for V3 observation-only search
 *
 * Tests the simplified search functionality using only observations.
 * No exchanges, vec_exchanges, or multi-concept search.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabaseV3, insertObservationV3 } from './db.v3.js';
import { applyRecencyBoost, search, type SearchOptions } from './search.v3.js';

// Global mock factory that can be controlled per test
let mockGenerateEmbedding: (() => Promise<number[]>) | null = null;

// Set up top-level mocks
vi.mock('./embeddings.js', () => ({
  initEmbeddings: vi.fn(async () => {}),
  generateEmbedding: vi.fn(async () => mockGenerateEmbedding?.() ?? [])
}));

describe('search.v3 - observation-only search', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Use in-memory database for testing
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
      sessionId: observation.sessionId ?? null,
      timestamp: observation.timestamp,
      createdAt: observation.timestamp
    }, embedding);
  }

  describe('applyRecencyBoost', () => {
    // Fixed reference date for consistent testing
    const fixedReferenceDate = new Date('2026-02-08T00:00:00Z').getTime();

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(fixedReferenceDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('should boost by 1.15 for today (days=0)', () => {
      const today = new Date(fixedReferenceDate).toISOString().split('T')[0];
      const result = applyRecencyBoost(0.8, today);
      // Boost = 1.15, so 0.8 * 1.15 = 0.92
      expect(result).toBeCloseTo(0.92, 2);
    });

    test('should have boost of 1.15 for days=0', () => {
      const today = new Date(fixedReferenceDate).toISOString().split('T')[0];
      const result = applyRecencyBoost(1.0, today);
      // Boost = 1.15, so 1.0 * 1.15 = 1.15
      expect(result).toBeCloseTo(1.15, 2);
    });

    test('should have boost of 1.0 for days=90', () => {
      // 90 days ago from fixed reference date
      const ninetyDaysAgo = new Date(fixedReferenceDate - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const result = applyRecencyBoost(1.0, ninetyDaysAgo);
      // Boost = 1.0, so 1.0 * 1.0 = 1.0
      expect(result).toBeCloseTo(1.0, 2);
    });

    test('should have boost of 0.85 for days=180', () => {
      // 180 days ago from fixed reference date
      const oneHEightyDaysAgo = new Date(fixedReferenceDate - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const result = applyRecencyBoost(1.0, oneHEightyDaysAgo);
      // Boost = 0.85, so 1.0 * 0.85 = 0.85
      expect(result).toBeCloseTo(0.85, 2);
    });

    test('should clamp boost to 0.85 for days=270 (beyond 180)', () => {
      // 270 days ago from fixed reference date
      const twoSeventyDaysAgo = new Date(fixedReferenceDate - 270 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const result = applyRecencyBoost(1.0, twoSeventyDaysAgo);
      // Boost should be clamped at 0.85
      expect(result).toBeCloseTo(0.85, 2);
    });

    test('should interpolate boost correctly for days=45', () => {
      // 45 days ago from fixed reference date
      const fortyFiveDaysAgo = new Date(fixedReferenceDate - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const result = applyRecencyBoost(1.0, fortyFiveDaysAgo);
      // Boost = 1.075, so 1.0 * 1.075 = 1.075
      expect(result).toBeCloseTo(1.075, 2);
    });

    test('should apply boost correctly with similarity=0.8 and days=0', () => {
      const today = new Date(fixedReferenceDate).toISOString().split('T')[0];
      const result = applyRecencyBoost(0.8, today);
      // Boost = 1.15, so 0.8 * 1.15 = 0.92
      expect(result).toBeCloseTo(0.92, 2);
    });

    test('should handle edge case of very old dates (beyond 180 days)', () => {
      // Very old date - should be clamped at 0.85
      const result = applyRecencyBoost(0.5, '2020-01-01');
      expect(result).toBeCloseTo(0.425, 2);
    });

    test('should handle similarity of 0', () => {
      const today = new Date(fixedReferenceDate).toISOString().split('T')[0];
      const result = applyRecencyBoost(0, today);
      expect(result).toBe(0);
    });

    test('should handle similarity of 1 with no boost effect on product', () => {
      const oneHEightyDaysAgo = new Date(fixedReferenceDate - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const result = applyRecencyBoost(1.0, oneHEightyDaysAgo);
      expect(result).toBeCloseTo(0.85, 2);
    });
  });

  describe('validateISODate (via search)', () => {
    test('should accept valid ISO date format', async () => {
      mockGenerateEmbedding = () => createTestEmbedding();

      try {
        await search('test query', { db, after: '2025-01-15', before: '2025-01-20', mode: 'text' });
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
      mockGenerateEmbedding = () => createTestEmbedding();

      await expect(
        search('test query', { db, after: '2025-1-5', mode: 'text' })
      ).rejects.toThrow('Invalid --after date');
    });

    test('should reject invalid date format - wrong separator', async () => {
      mockGenerateEmbedding = () => createTestEmbedding();

      await expect(
        search('test query', { db, after: '2025/01/15', mode: 'text' })
      ).rejects.toThrow('Invalid --after date');
    });

    test('should reject invalid calendar date - truly invalid date', async () => {
      mockGenerateEmbedding = () => createTestEmbedding();

      await expect(
        search('test query', { db, after: 'invalid-date', mode: 'text' })
      ).rejects.toThrow('Invalid --after date');
    });

    test('should reject invalid month', async () => {
      mockGenerateEmbedding = () => createTestEmbedding();

      await expect(
        search('test query', { db, after: '2025-13-01', mode: 'text' })
      ).rejects.toThrow('Not a valid calendar date');
    });

    test('should accept leap year date', async () => {
      mockGenerateEmbedding = () => createTestEmbedding();

      try {
        await search('test query', { db, after: '2024-02-29', mode: 'text' });
        expect(true).toBe(true);
      } catch (error: any) {
        if (error.message.includes('Invalid')) {
          throw error;
        }
      }
    });
  });

  describe('search - text mode', () => {
    beforeEach(() => {
      const now = Date.now();

      // Insert test observations
      insertTestObservation(db, {
        title: 'How to implement authentication',
        content: 'You can use passport.js for authentication in Node.js applications',
        project: 'test-project',
        sessionId: 'session-1',
        timestamp: now - 2000
      });

      insertTestObservation(db, {
        title: 'Database schema design',
        content: 'Proper indexing improves query performance significantly',
        project: 'test-project',
        sessionId: 'session-2',
        timestamp: now - 1000
      });

      insertTestObservation(db, {
        title: 'Testing strategies',
        content: 'Unit tests help catch bugs early in development',
        project: 'test-project',
        sessionId: 'session-3',
        timestamp: now
      });
    });

    test('should perform text search using FTS', async () => {
      mockGenerateEmbedding = () => createTestEmbedding();

      const results = await search('authentication', { db, mode: 'text' });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(r => r.title.toLowerCase().includes('authentication') || r.content.toLowerCase().includes('authentication'))).toBe(true);
    });

    test('should search in both title and content', async () => {
      mockGenerateEmbedding = () => createTestEmbedding();

      const results = await search('passport.js', { db, mode: 'text' });
      expect(results.length).toBeGreaterThanOrEqual(1);

      const results2 = await search('implement', { db, mode: 'text' });
      expect(results2.length).toBeGreaterThanOrEqual(1);
    });

    test('should respect limit in text mode', async () => {
      mockGenerateEmbedding = () => createTestEmbedding();

      const results = await search('test', { db, mode: 'text', limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should return empty array for no matches', async () => {
      mockGenerateEmbedding = () => createTestEmbedding();

      const results = await search('nonexistentterm12345', { db, mode: 'text' });
      expect(results).toEqual([]);
    });

    test('should filter by project in text mode', async () => {
      const now = Date.now();

      insertTestObservation(db, {
        title: 'Project A specific',
        content: 'Content for project A',
        project: 'project-a',
        sessionId: 'session-a',
        timestamp: now + 1000
      });

      mockGenerateEmbedding = () => createTestEmbedding();

      const results = await search('content', { db, mode: 'text', projects: ['project-a'] });
      expect(results.every(r => r.project === 'project-a')).toBe(true);
    });

    test('should filter by date range in text mode', async () => {
      const now = Date.now();

      const oldDate = new Date('2025-01-10').getTime();
      const newDate = new Date('2025-01-20').getTime();

      insertTestObservation(db, {
        title: 'Old observation',
        content: 'Old content',
        project: 'test-project',
        timestamp: oldDate
      });

      insertTestObservation(db, {
        title: 'New observation',
        content: 'New content',
        project: 'test-project',
        timestamp: newDate
      });

      mockGenerateEmbedding = () => createTestEmbedding();

      const results = await search('content', {
        db,
        mode: 'text',
        after: '2025-01-15',
        before: '2025-01-25'
      });

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('New observation');
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
      mockGenerateEmbedding = () => createTestEmbedding(1); // Similar to first observation

      const results = await search('authentication', { db, mode: 'vector' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('similarity');
      expect(typeof results[0].similarity).toBe('number');
    });

    test('should apply recency boost to vector results', async () => {
      // Fixed reference date for testing
      const fixedReferenceDate = new Date('2026-02-08T00:00:00Z').getTime();
      vi.useFakeTimers();
      vi.setSystemTime(fixedReferenceDate);

      const today = new Date(fixedReferenceDate).toISOString().split('T')[0];

      // Insert an observation from today
      insertTestObservation(db, {
        title: 'Recent observation',
        content: 'Content from today',
        project: 'test-project',
        timestamp: fixedReferenceDate
      }, createTestEmbedding(4));

      mockGenerateEmbedding = () => createTestEmbedding(4);

      const results = await search('recent', { db, mode: 'vector' });

      const recentResult = results.find(r => r.title === 'Recent observation');
      expect(recentResult).toBeDefined();
      // The similarity should be boosted (> base similarity)
      if (recentResult && recentResult.similarity !== undefined) {
        expect(recentResult.similarity).toBeGreaterThan(0.8);
      }

      vi.useRealTimers();
    });

    test('should respect limit in vector mode', async () => {
      mockGenerateEmbedding = () => createTestEmbedding(1);

      const results = await search('test', { db, mode: 'vector', limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should filter by project in vector mode', async () => {
      const now = Date.now();

      insertTestObservation(db, {
        title: 'Project A observation',
        content: 'Content for project A',
        project: 'project-a',
        timestamp: now + 1000
      }, createTestEmbedding(5));

      mockGenerateEmbedding = () => createTestEmbedding(5);

      const results = await search('project', { db, mode: 'vector', projects: ['project-a'] });
      expect(results.every(r => r.project === 'project-a')).toBe(true);
    });
  });

  describe('search - both mode', () => {
    beforeEach(() => {
      const now = Date.now();

      insertTestObservation(db, {
        title: 'Vector match test',
        content: 'This should match vector search',
        project: 'test-project',
        timestamp: now - 2000
      }, createTestEmbedding(10));

      insertTestObservation(db, {
        title: 'Text match test',
        content: 'This should match text search',
        project: 'test-project',
        timestamp: now - 1000
      }, createTestEmbedding(20));

      insertTestObservation(db, {
        title: 'Both match test',
        content: 'This should match both searches',
        project: 'test-project',
        timestamp: now
      }, createTestEmbedding(30));
    });

    test('should combine vector and text results', async () => {
      mockGenerateEmbedding = () => createTestEmbedding(10);

      const results = await search('match', { db, mode: 'both' });

      // Should have results from both searches
      expect(results.length).toBeGreaterThan(0);
    });

    test('should deduplicate results by ID', async () => {
      mockGenerateEmbedding = () => createTestEmbedding(30);

      const results = await search('both match', { db, mode: 'both' });

      // Check that there are no duplicate IDs
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test('should prioritize vector results with similarity scores', async () => {
      mockGenerateEmbedding = () => createTestEmbedding(30);

      const results = await search('both', { db, mode: 'both' });

      // Results with similarity should come first
      const hasSimilarity = results.filter(r => r.similarity !== undefined);
      const noSimilarity = results.filter(r => r.similarity === undefined);

      // All vector results should appear before text-only results
      if (hasSimilarity.length > 0 && noSimilarity.length > 0) {
        const lastWithSim = results.lastIndexOf(hasSimilarity[hasSimilarity.length - 1]);
        const firstWithoutSim = results.indexOf(noSimilarity[0]);
        expect(lastWithSim).toBeLessThan(firstWithoutSim);
      }
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
      mockGenerateEmbedding = () => createTestEmbedding(1);

      const results = await search('test', { db, mode: 'vector' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('project');
      expect(results[0]).toHaveProperty('timestamp');
      expect(results[0]).toHaveProperty('similarity');
    });

    test('should not include content in compact results', async () => {
      mockGenerateEmbedding = () => createTestEmbedding(1);

      const results = await search('test', { db, mode: 'vector' });

      expect(results[0]).not.toHaveProperty('content');
    });

    test('should not include sessionId in compact results', async () => {
      mockGenerateEmbedding = () => createTestEmbedding(1);

      const results = await search('test', { db, mode: 'vector' });

      expect(results[0]).not.toHaveProperty('sessionId');
    });

    test('should return similarity as number for vector mode', async () => {
      mockGenerateEmbedding = () => createTestEmbedding(1);

      const results = await search('test', { db, mode: 'vector' });

      expect(results[0].similarity).toBeDefined();
      expect(typeof results[0].similarity).toBe('number');
    });

    test('should return undefined similarity for text mode', async () => {
      mockGenerateEmbedding = () => createTestEmbedding(1);

      const results = await search('test', { db, mode: 'text' });

      expect(results[0].similarity).toBeUndefined();
    });

    test('should order results by similarity (vector mode)', async () => {
      const now = Date.now();

      insertTestObservation(db, {
        title: 'Low similarity',
        content: 'Low',
        project: 'test-project',
        timestamp: now - 2000
      }, createTestEmbedding(100));

      insertTestObservation(db, {
        title: 'High similarity',
        content: 'High',
        project: 'test-project',
        timestamp: now - 1000
      }, createTestEmbedding(1));

      // Mock embedding similar to "High similarity"
      mockGenerateEmbedding = () => createTestEmbedding(1);

      const results = await search('test', { db, mode: 'vector' });

      // Results should be ordered by similarity (highest first)
      for (let i = 1; i < results.length; i++) {
        if (results[i].similarity !== undefined && results[i - 1].similarity !== undefined) {
          expect(results[i].similarity).toBeLessThanOrEqual(results[i - 1].similarity);
        }
      }
    });

    test('should order text results by timestamp (newest first)', async () => {
      mockGenerateEmbedding = () => createTestEmbedding(1);

      const results = await search('test', { db, mode: 'text' });

      // Text results should be ordered by timestamp descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i].timestamp).toBeLessThanOrEqual(results[i - 1].timestamp);
      }
    });
  });

  describe('search - edge cases', () => {
    test('should handle empty database', async () => {
      mockGenerateEmbedding = () => createTestEmbedding();

      const results = await search('test', { db, mode: 'text' });
      expect(results).toEqual([]);
    });

    test('should handle special characters in query', async () => {
      insertTestObservation(db, {
        title: 'Special chars test',
        content: 'Test with special characters: @#$%^&*()',
        project: 'test-project',
        timestamp: Date.now()
      });

      mockGenerateEmbedding = () => createTestEmbedding();

      const results = await search('special', { db, mode: 'text' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    test('should handle unicode characters', async () => {
      insertTestObservation(db, {
        title: 'Unicode test',
        content: 'Test with unicode: Hello 世界 🌍',
        project: 'test-project',
        timestamp: Date.now()
      });

      mockGenerateEmbedding = () => createTestEmbedding();

      const results = await search('unicode', { db, mode: 'text' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    test('should handle very long queries', async () => {
      const longQuery = 'a'.repeat(1000);

      mockGenerateEmbedding = () => createTestEmbedding();

      // Should not throw
      const results = await search(longQuery, { db, mode: 'text' });
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
