import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Import types
import { CompactSearchResult, CompactMultiConceptResult } from './types.js';

// Global mock factory that can be controlled per test
let mockDbInstance: Database | null = null;
let mockGenerateEmbedding: (() => Promise<number[]>) | null = null;

// Set up top-level mocks
vi.mock('./db.js', () => ({
  initDatabase: vi.fn(() => mockDbInstance)
}));

vi.mock('./embeddings.js', () => ({
  initEmbeddings: vi.fn(async () => {}),
  generateEmbedding: vi.fn(async () => mockGenerateEmbedding?.() ?? [])
}));

// Import functions to test AFTER mocks are set up
import {
  searchConversations,
  formatResults,
  searchMultipleConcepts,
  formatMultiConceptResults,
  applyRecencyBoost,
  type SearchOptions
} from './search.js';

// Helper to create a test database
let testDbPath: string;
let testDb: Database;

function createTestDatabase(): Database {
  testDbPath = path.join(tmpdir(), `test-search-${Date.now()}.db`);
  const db = new Database(testDbPath);

  // Create test schema (without sqlite-vec for now, using simpler approach)
  db.exec(`
    CREATE TABLE exchanges (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      user_message TEXT NOT NULL,
      assistant_message TEXT NOT NULL,
      archive_path TEXT NOT NULL,
      line_start INTEGER NOT NULL,
      line_end INTEGER NOT NULL,
      compressed_tool_summary TEXT
    )
  `);

  // Create a simple mock for vec_exchanges that we'll populate with mock data
  // For actual vector tests, we'll mock the searchConversations function
  db.exec(`
    CREATE TABLE vec_exchanges (
      id TEXT PRIMARY KEY,
      embedding BLOB
    )
  `);

  return db;
}

function cleanupTestDatabase(): void {
  if (testDb) {
    testDb.close();
  }
  if (testDbPath && fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
}

// Helper to insert test exchange
function insertTestExchange(
  db: Database,
  exchange: {
    id: string;
    project: string;
    timestamp: string;
    userMessage: string;
    assistantMessage: string;
    archivePath: string;
    lineStart: number;
    lineEnd: number;
  }
): void {
  const stmt = db.prepare(`
    INSERT INTO exchanges (id, project, timestamp, user_message, assistant_message, archive_path, line_start, line_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    exchange.id,
    exchange.project,
    exchange.timestamp,
    exchange.userMessage,
    exchange.assistantMessage,
    exchange.archivePath,
    exchange.lineStart,
    exchange.lineEnd
  );
}

// Helper to insert test embedding
function insertTestEmbedding(db: Database, id: string, embedding: number[]): void {
  const delStmt = db.prepare(`DELETE FROM vec_exchanges WHERE id = ?`);
  delStmt.run(id);

  const vecStmt = db.prepare(`
    INSERT INTO vec_exchanges (id, embedding)
    VALUES (?, ?)
  `);
  vecStmt.run(id, new Uint8Array(new Float32Array(embedding).buffer));
}

// Create a simple 768-dimensional test embedding vector
function createTestEmbedding(seed: number = 0): number[] {
  return Array.from({ length: 768 }, (_, i) => Math.sin(seed + i * 0.1) * 0.5 + 0.5);
}

describe('validateISODate (via searchConversations)', () => {
  // validateISODate is a private function, tested indirectly through searchConversations
  test('should accept valid ISO date format', async () => {
    const db = createTestDatabase();
    mockDbInstance = db;
    mockGenerateEmbedding = () => createTestEmbedding();

    try {
      await searchConversations('test query', { after: '2025-01-15', before: '2025-01-20', mode: 'text' });
      // If we get here without throwing, date validation passed
      expect(true).toBe(true);
    } finally {
      cleanupTestDatabase();
      mockDbInstance = null;
      mockGenerateEmbedding = null;
    }
  });

  test('should reject invalid date format - missing leading zeros', async () => {
    const db = createTestDatabase();
    mockDbInstance = db;
    mockGenerateEmbedding = () => createTestEmbedding();

    try {
      await searchConversations('test query', { after: '2025-1-5', mode: 'text' });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain('Invalid --after date');
      expect(error.message).toContain('YYYY-MM-DD format');
    } finally {
      cleanupTestDatabase();
      mockDbInstance = null;
      mockGenerateEmbedding = null;
    }
  });

  test('should reject invalid date format - wrong separator', async () => {
    const db = createTestDatabase();
    mockDbInstance = db;
    mockGenerateEmbedding = () => createTestEmbedding();

    try {
      await searchConversations('test query', { after: '2025/01/15', mode: 'text' });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain('Invalid --after date');
    } finally {
      cleanupTestDatabase();
      mockDbInstance = null;
      mockGenerateEmbedding = null;
    }
  });

  test('should reject invalid calendar date - truly invalid date', async () => {
    const db = createTestDatabase();
    mockDbInstance = db;
    mockGenerateEmbedding = () => createTestEmbedding();

    try {
      // Test with an invalid date that JS Date will reject (NaN)
      // Using an invalid ISO format that produces NaN
      await searchConversations('test query', { after: 'invalid-date', mode: 'text' });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain('Invalid --after date');
    } finally {
      cleanupTestDatabase();
      mockDbInstance = null;
      mockGenerateEmbedding = null;
    }
  });

  test('should reject invalid month', async () => {
    const db = createTestDatabase();
    mockDbInstance = db;
    mockGenerateEmbedding = () => createTestEmbedding();

    try {
      await searchConversations('test query', { after: '2025-13-01', mode: 'text' });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain('Not a valid calendar date');
    } finally {
      cleanupTestDatabase();
      mockDbInstance = null;
      mockGenerateEmbedding = null;
    }
  });

  test('should accept leap year date', async () => {
    const db = createTestDatabase();
    mockDbInstance = db;
    mockGenerateEmbedding = () => createTestEmbedding();

    try {
      await searchConversations('test query', { after: '2024-02-29', mode: 'text' });
      expect(true).toBe(true);
    } finally {
      cleanupTestDatabase();
      mockDbInstance = null;
      mockGenerateEmbedding = null;
    }
  });
});

describe('searchConversations - text mode', () => {
  beforeEach(() => {
    testDb = createTestDatabase();
    mockDbInstance = testDb;
    mockGenerateEmbedding = () => createTestEmbedding();
  });

  afterEach(() => {
    cleanupTestDatabase();
    mockDbInstance = null;
    mockGenerateEmbedding = null;
  });

  test('should perform text search using LIKE', async () => {
    insertTestExchange(testDb, {
      id: '1',
      project: 'test-project',
      timestamp: '2025-01-15T10:00:00Z',
      userMessage: 'How do I implement authentication in Node.js?',
      assistantMessage: 'You can use passport.js for authentication',
      archivePath: '/archive/test.jsonl',
      lineStart: 1,
      lineEnd: 10
    });

    const results = await searchConversations('authentication', { mode: 'text' });
    expect(results.length).toBe(1);
    expect(results[0].snippet).toContain('authentication');
    expect(results[0].similarity).toBeUndefined();
    // Verify it's a CompactSearchResult (no exchange property)
    expect('exchange' in results[0]).toBe(false);
    // Verify snippet length is limited
    expect(results[0].snippet.length).toBeLessThanOrEqual(103);
  });

  test('should search in both user and assistant messages', async () => {
    insertTestExchange(testDb, {
      id: '1',
      project: 'test-project',
      timestamp: '2025-01-15T10:00:00Z',
      userMessage: 'How do I add users?',
      assistantMessage: 'Use the createUser function to add users to the database',
      archivePath: '/archive/test.jsonl',
      lineStart: 1,
      lineEnd: 10
    });

    insertTestExchange(testDb, {
      id: '2',
      project: 'test-project',
      timestamp: '2025-01-15T11:00:00Z',
      userMessage: 'What is the weather?',
      assistantMessage: 'The weather is sunny today',
      archivePath: '/archive/test2.jsonl',
      lineStart: 1,
      lineEnd: 10
    });

    // Search for "users" which appears in assistant message of first exchange
    const results = await searchConversations('users', { mode: 'text' });
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test('should respect limit in text mode', async () => {
    for (let i = 1; i <= 5; i++) {
      insertTestExchange(testDb, {
        id: `${i}`,
        project: 'test-project',
        timestamp: `2025-01-${10 + i}T10:00:00Z`,
        userMessage: `Test message about testing`,
        assistantMessage: `Test response`,
        archivePath: `/archive/test${i}.jsonl`,
        lineStart: i,
        lineEnd: i + 5
      });
    }

    const results = await searchConversations('test', { mode: 'text', limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  test('should return empty array for no matches', async () => {
    insertTestExchange(testDb, {
      id: '1',
      project: 'test-project',
      timestamp: '2025-01-15T10:00:00Z',
      userMessage: 'Completely different topic',
      assistantMessage: 'Also different',
      archivePath: '/archive/test.jsonl',
      lineStart: 1,
      lineEnd: 10
    });

    const results = await searchConversations('nonexistentterm12345', { mode: 'text' });
    expect(results).toEqual([]);
  });

  test('should filter by project in text mode', async () => {
    insertTestExchange(testDb, {
      id: '1',
      project: 'project-a',
      timestamp: '2025-01-15T10:00:00Z',
      userMessage: 'test message',
      assistantMessage: 'test response',
      archivePath: '/archive/a.jsonl',
      lineStart: 1,
      lineEnd: 10
    });

    insertTestExchange(testDb, {
      id: '2',
      project: 'project-b',
      timestamp: '2025-01-15T11:00:00Z',
      userMessage: 'test message',
      assistantMessage: 'test response',
      archivePath: '/archive/b.jsonl',
      lineStart: 1,
      lineEnd: 10
    });

    const results = await searchConversations('test', { mode: 'text', projects: ['project-a'] });
    expect(results.every(r => r.project === 'project-a')).toBe(true);
    // Verify it's a CompactSearchResult (no exchange property)
    expect('exchange' in results[0]).toBe(false);
    // Verify no userMessage/assistantMessage properties
    expect('userMessage' in results[0]).toBe(false);
    expect('assistantMessage' in results[0]).toBe(false);
  });

  test('should filter by date range in text mode', async () => {
    insertTestExchange(testDb, {
      id: '1',
      project: 'test-project',
      timestamp: '2025-01-10T10:00:00Z',
      userMessage: 'Test message',
      assistantMessage: 'Test response',
      archivePath: '/archive/test.jsonl',
      lineStart: 1,
      lineEnd: 10
    });

    insertTestExchange(testDb, {
      id: '2',
      project: 'test-project',
      timestamp: '2025-01-20T10:00:00Z',
      userMessage: 'Test message',
      assistantMessage: 'Test response',
      archivePath: '/archive/test.jsonl',
      lineStart: 20,
      lineEnd: 30
    });

    const results = await searchConversations('test', {
      mode: 'text',
      after: '2025-01-15',
      before: '2025-01-25'
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('2');
    // Verify it's a CompactSearchResult (no exchange property)
    expect('exchange' in results[0]).toBe(false);
    // Verify no summary property (summary is removed)
    expect('summary' in results[0]).toBe(false);
  });
});

describe('formatResults', () => {
  test('should return "No results found" for empty array', () => {
    const output = formatResults([]);
    expect(output).toBe('No results found.');
  });

  test('should format single result correctly', () => {
    const results: CompactSearchResult[] = [
      {
        id: '1',
        project: 'test-project',
        timestamp: '2025-01-15T10:00:00Z',
        archivePath: '/archive/test.jsonl',
        lineStart: 1,
        lineEnd: 10,
        similarity: 0.85,
        snippet: 'How do I implement authentication?'
      }
    ];

    const output = formatResults(results);
    expect(output).toContain('Found 1 relevant conversation:');
    expect(output).toContain('[test-project, 2025-01-15]');
    expect(output).toContain('85% match');
    expect(output).toContain('"How do I implement authentication?"');
    expect(output).toContain('Lines 1-10 in /archive/test.jsonl');
    // Should NOT contain file size and line count metadata
    expect(output).not.toContain('KB');
    expect(output).not.toMatch(/\(\d+ lines\)/);
  });

  test('should format multiple results', () => {
    const results: CompactSearchResult[] = [
      {
        id: '1',
        project: 'project-a',
        timestamp: '2025-01-15T10:00:00Z',
        archivePath: '/archive/test1.jsonl',
        lineStart: 1,
        lineEnd: 5,
        similarity: 0.9,
        snippet: 'First question'
      },
      {
        id: '2',
        project: 'project-b',
        timestamp: '2025-01-16T10:00:00Z',
        archivePath: '/archive/test2.jsonl',
        lineStart: 1,
        lineEnd: 8,
        similarity: 0.75,
        snippet: 'Second question'
      }
    ];

    const output = formatResults(results);
    expect(output).toContain('Found 2 relevant conversations:');
    expect(output).toContain('[project-a, 2025-01-15] - 90% match');
    expect(output).toContain('[project-b, 2025-01-16] - 75% match');
    expect(output).toContain('Lines 1-5 in /archive/test1.jsonl');
    expect(output).toContain('Lines 1-8 in /archive/test2.jsonl');
    // Should NOT contain file size and line count metadata
    expect(output).not.toContain('KB');
    expect(output).not.toMatch(/\(\d+ lines\)/);
  });

  test('should include tool calls when present', () => {
    const results: CompactSearchResult[] = [
      {
        id: '1',
        project: 'test-project',
        timestamp: '2025-01-15T10:00:00Z',
        archivePath: '/archive/test.jsonl',
        lineStart: 1,
        lineEnd: 5,
        compressedToolSummary: 'Bash: `ls` | Read: /tmp/file.txt',
        similarity: 0.8,
        snippet: 'Question'
      }
    ];

    const output = formatResults(results);
    expect(output).toContain('Actions:');
    expect(output).toContain('Bash: `ls` | Read: /tmp/file.txt');
  });

  test('should handle text mode results without similarity', () => {
    const results: CompactSearchResult[] = [
      {
        id: '1',
        project: 'test-project',
        timestamp: '2025-01-15T10:00:00Z',
        archivePath: '/archive/test.jsonl',
        lineStart: 1,
        lineEnd: 5,
        similarity: undefined,
        snippet: 'Question'
      }
    ];

    const output = formatResults(results);
    expect(output).toContain('[test-project, 2025-01-15]');
    expect(output).not.toContain('% match');
  });

  test('should truncate long user messages in snippet', () => {
    const longMessage = 'A'.repeat(300);

    const results: CompactSearchResult[] = [
      {
        id: '1',
        project: 'test-project',
        timestamp: '2025-01-15T10:00:00Z',
        archivePath: '/archive/test.jsonl',
        lineStart: 1,
        lineEnd: 5,
        similarity: 0.8,
        snippet: longMessage.substring(0, 200) + '...'
      }
    ];

    const output = formatResults(results);
    expect(output).toContain('...');
  });
});

describe('searchMultipleConcepts', () => {
  // Note: These tests use the actual implementation but with text mode
  // since vector mode requires sqlite-vec which doesn't work with bun:sqlite (deprecated)
  test('should return empty array for empty concepts', async () => {
    const results = await searchMultipleConcepts([], {});
    expect(results).toEqual([]);
  });

  // The remaining searchMultipleConcepts tests are skipped for bun testing (deprecated)
  // because vector search requires sqlite-vec which doesn't work with bun:sqlite (deprecated)
  // These tests should be run with Node.js and better-sqlite3 instead

  test.skip('should find conversations matching all concepts', async () => {
    // Skipped: requires full sqlite-vec support
    // Test is covered in integration tests with Node.js
  });

  test.skip('should calculate average similarity across concepts', async () => {
    // Skipped: requires full sqlite-vec support
  });

  test.skip('should respect limit parameter', async () => {
    // Skipped: requires full sqlite-vec support
  });

  test.skip('should filter by projects', async () => {
    // Skipped: requires full sqlite-vec support
  });

  test.skip('should filter by date range', async () => {
    // Skipped: requires full sqlite-vec support
  });
});

describe('formatMultiConceptResults', () => {
  test('should return message for empty results', () => {
    const output = formatMultiConceptResults([], ['auth', 'security']);
    expect(output).toContain('No conversations found matching all concepts');
    expect(output).toContain('auth, security');
  });

  test('should format multi-concept results', () => {
    const results: CompactMultiConceptResult[] = [
      {
        id: '1',
        project: 'test-project',
        timestamp: '2025-01-15T10:00:00Z',
        archivePath: '/archive/test.jsonl',
        lineStart: 1,
        lineEnd: 10,
        snippet: 'How to implement authentication?',
        conceptSimilarities: [0.85, 0.72],
        averageSimilarity: 0.785
      }
    ];

    const output = formatMultiConceptResults(results, ['authentication', 'JWT']);
    expect(output).toContain('Found 1 conversation matching all concepts');
    expect(output).toContain('[authentication + JWT]');
    expect(output).toContain('79% avg match');
    expect(output).toContain('authentication: 85%');
    expect(output).toContain('JWT: 72%');
    expect(output).toContain('Lines 1-10 in /archive/test.jsonl');
    // Should NOT contain file size and line count metadata
    expect(output).not.toContain('KB');
    expect(output).not.toMatch(/\(\d+ lines\)/);
  });

  test('should include tool calls in multi-concept format', () => {
    const results: CompactMultiConceptResult[] = [
      {
        id: '1',
        project: 'test-project',
        timestamp: '2025-01-15T10:00:00Z',
        archivePath: '/archive/test.jsonl',
        lineStart: 1,
        lineEnd: 10,
        compressedToolSummary: 'Bash: `ls`',
        snippet: 'Question',
        conceptSimilarities: [0.8],
        averageSimilarity: 0.8
      }
    ];

    const output = formatMultiConceptResults(results, ['concept1']);
    expect(output).toContain('Actions:');
    expect(output).toContain('Bash: `ls`');
  });
});

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
