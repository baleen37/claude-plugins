import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import Database from 'bun:sqlite';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Import functions to test
import {
  searchConversations,
  formatResults,
  searchMultipleConcepts,
  formatMultiConceptResults,
  type SearchOptions
} from './search.js';

// Import types
import { ConversationExchange, SearchResult, MultiConceptResult } from './types.js';

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
      line_end INTEGER NOT NULL
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

    const initDbMock = mock(() => db);
    mock.module('./db.js', () => ({
      initDatabase: initDbMock
    }));

    mock.module('./embeddings.js', () => ({
      initEmbeddings: async () => {},
      generateEmbedding: async () => createTestEmbedding()
    }));

    try {
      await searchConversations('test query', { after: '2025-01-15', before: '2025-01-20', mode: 'text' });
      // If we get here without throwing, date validation passed
      expect(true).toBe(true);
    } finally {
      cleanupTestDatabase();
      initDbMock.mockRestore();
      mock.restore();
    }
  });

  test('should reject invalid date format - missing leading zeros', async () => {
    const db = createTestDatabase();

    const initDbMock = mock(() => db);
    mock.module('./db.js', () => ({
      initDatabase: initDbMock
    }));

    mock.module('./embeddings.js', () => ({
      initEmbeddings: async () => {},
      generateEmbedding: async () => createTestEmbedding()
    }));

    try {
      await searchConversations('test query', { after: '2025-1-5', mode: 'text' });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain('Invalid --after date');
      expect(error.message).toContain('YYYY-MM-DD format');
    } finally {
      cleanupTestDatabase();
      initDbMock.mockRestore();
      mock.restore();
    }
  });

  test('should reject invalid date format - wrong separator', async () => {
    const db = createTestDatabase();

    const initDbMock = mock(() => db);
    mock.module('./db.js', () => ({
      initDatabase: initDbMock
    }));

    mock.module('./embeddings.js', () => ({
      initEmbeddings: async () => {},
      generateEmbedding: async () => createTestEmbedding()
    }));

    try {
      await searchConversations('test query', { after: '2025/01/15', mode: 'text' });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain('Invalid --after date');
    } finally {
      cleanupTestDatabase();
      initDbMock.mockRestore();
      mock.restore();
    }
  });

  test('should reject invalid calendar date - truly invalid date', async () => {
    const db = createTestDatabase();

    const initDbMock = mock(() => db);
    mock.module('./db.js', () => ({
      initDatabase: initDbMock
    }));

    mock.module('./embeddings.js', () => ({
      initEmbeddings: async () => {},
      generateEmbedding: async () => createTestEmbedding()
    }));

    try {
      // Test with an invalid date that JS Date will reject (NaN)
      // Using an invalid ISO format that produces NaN
      await searchConversations('test query', { after: 'invalid-date', mode: 'text' });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain('Invalid --after date');
    } finally {
      cleanupTestDatabase();
      initDbMock.mockRestore();
      mock.restore();
    }
  });

  test('should reject invalid month', async () => {
    const db = createTestDatabase();

    const initDbMock = mock(() => db);
    mock.module('./db.js', () => ({
      initDatabase: initDbMock
    }));

    mock.module('./embeddings.js', () => ({
      initEmbeddings: async () => {},
      generateEmbedding: async () => createTestEmbedding()
    }));

    try {
      await searchConversations('test query', { after: '2025-13-01', mode: 'text' });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain('Not a valid calendar date');
    } finally {
      cleanupTestDatabase();
      initDbMock.mockRestore();
      mock.restore();
    }
  });

  test('should accept leap year date', async () => {
    const db = createTestDatabase();

    const initDbMock = mock(() => db);
    mock.module('./db.js', () => ({
      initDatabase: initDbMock
    }));

    mock.module('./embeddings.js', () => ({
      initEmbeddings: async () => {},
      generateEmbedding: async () => createTestEmbedding()
    }));

    try {
      await searchConversations('test query', { after: '2024-02-29', mode: 'text' });
      expect(true).toBe(true);
    } finally {
      cleanupTestDatabase();
      initDbMock.mockRestore();
      mock.restore();
    }
  });
});

describe('searchConversations - text mode', () => {
  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase();
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

    const initDbMock = mock(() => testDb);
    mock.module('./db.js', () => ({
      initDatabase: initDbMock
    }));

    try {
      const results = await searchConversations('authentication', { mode: 'text' });
      expect(results.length).toBe(1);
      expect(results[0].exchange.userMessage).toContain('authentication');
      expect(results[0].similarity).toBeUndefined();
    } finally {
      initDbMock.mockRestore();
      mock.restore();
    }
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

    const initDbMock = mock(() => testDb);
    mock.module('./db.js', () => ({
      initDatabase: initDbMock
    }));

    try {
      // Search for "users" which appears in assistant message of first exchange
      const results = await searchConversations('users', { mode: 'text' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    } finally {
      initDbMock.mockRestore();
      mock.restore();
    }
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

    const initDbMock = mock(() => testDb);
    mock.module('./db.js', () => ({
      initDatabase: initDbMock
    }));

    try {
      const results = await searchConversations('test', { mode: 'text', limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    } finally {
      initDbMock.mockRestore();
      mock.restore();
    }
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

    const initDbMock = mock(() => testDb);
    mock.module('./db.js', () => ({
      initDatabase: initDbMock
    }));

    try {
      const results = await searchConversations('nonexistentterm12345', { mode: 'text' });
      expect(results).toEqual([]);
    } finally {
      initDbMock.mockRestore();
      mock.restore();
    }
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

    const initDbMock = mock(() => testDb);
    mock.module('./db.js', () => ({
      initDatabase: initDbMock
    }));

    try {
      const results = await searchConversations('test', { mode: 'text', projects: ['project-a'] });
      expect(results.every(r => r.exchange.project === 'project-a')).toBe(true);
    } finally {
      initDbMock.mockRestore();
      mock.restore();
    }
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

    const initDbMock = mock(() => testDb);
    mock.module('./db.js', () => ({
      initDatabase: initDbMock
    }));

    try {
      const results = await searchConversations('test', {
        mode: 'text',
        after: '2025-01-15',
        before: '2025-01-25'
      });
      expect(results.length).toBe(1);
      expect(results[0].exchange.id).toBe('2');
    } finally {
      initDbMock.mockRestore();
      mock.restore();
    }
  });
});

describe('formatResults', () => {
  test('should return "No results found" for empty array', async () => {
    const output = await formatResults([]);
    expect(output).toBe('No results found.');
  });

  test('should format single result correctly', async () => {
    const mockExchange: ConversationExchange = {
      id: '1',
      project: 'test-project',
      timestamp: '2025-01-15T10:00:00Z',
      userMessage: 'How do I implement authentication?',
      assistantMessage: 'Use JWT tokens',
      archivePath: '/tmp/test-archive.jsonl',
      lineStart: 1,
      lineEnd: 10
    };

    // Create a temporary archive file for testing
    const archivePath = '/tmp/test-archive.jsonl';
    fs.writeFileSync(archivePath, 'line1\nline2\nline3\n');

    const results: SearchResult[] = [
      {
        exchange: mockExchange,
        similarity: 0.85,
        snippet: 'How do I implement authentication?'
      }
    ];

    try {
      const output = await formatResults(results);
      expect(output).toContain('Found 1 relevant conversation:');
      expect(output).toContain('[test-project, 2025-01-15]');
      expect(output).toContain('85% match');
      expect(output).toContain('"How do I implement authentication?"');
      expect(output).toContain('Lines 1-10');
      expect(output).toContain('/tmp/test-archive.jsonl');
    } finally {
      fs.unlinkSync(archivePath);
    }
  });

  test('should format multiple results', async () => {
    const archivePath1 = '/tmp/test-archive1.jsonl';
    const archivePath2 = '/tmp/test-archive2.jsonl';
    fs.writeFileSync(archivePath1, 'line1\nline2\n');
    fs.writeFileSync(archivePath2, 'line1\nline2\nline3\n');

    const results: SearchResult[] = [
      {
        exchange: {
          id: '1',
          project: 'project-a',
          timestamp: '2025-01-15T10:00:00Z',
          userMessage: 'First question',
          assistantMessage: 'First answer',
          archivePath: archivePath1,
          lineStart: 1,
          lineEnd: 5
        },
        similarity: 0.9,
        snippet: 'First question'
      },
      {
        exchange: {
          id: '2',
          project: 'project-b',
          timestamp: '2025-01-16T10:00:00Z',
          userMessage: 'Second question',
          assistantMessage: 'Second answer',
          archivePath: archivePath2,
          lineStart: 1,
          lineEnd: 8
        },
        similarity: 0.75,
        snippet: 'Second question'
      }
    ];

    try {
      const output = await formatResults(results);
      expect(output).toContain('Found 2 relevant conversations:');
      expect(output).toContain('[project-a, 2025-01-15] - 90% match');
      expect(output).toContain('[project-b, 2025-01-16] - 75% match');
      expect(output).toContain('Lines 1-5');
      expect(output).toContain('Lines 1-8');
    } finally {
      fs.unlinkSync(archivePath1);
      fs.unlinkSync(archivePath2);
    }
  });

  test('should include summary when available and concise', async () => {
    const archivePath = '/tmp/test-archive.jsonl';
    fs.writeFileSync(archivePath, 'line1\nline2\n');

    const summaryPath = '/tmp/test-archive-summary.txt';
    fs.writeFileSync(summaryPath, 'Brief summary of the conversation');

    const results: Array<SearchResult & { summary?: string }> = [
      {
        exchange: {
          id: '1',
          project: 'test-project',
          timestamp: '2025-01-15T10:00:00Z',
          userMessage: 'Question',
          assistantMessage: 'Answer',
          archivePath: archivePath,
          lineStart: 1,
          lineEnd: 5
        },
        similarity: 0.8,
        snippet: 'Question',
        summary: 'Brief summary of the conversation'
      }
    ];

    try {
      const output = await formatResults(results);
      expect(output).toContain('Brief summary of the conversation');
    } finally {
      fs.unlinkSync(archivePath);
      fs.unlinkSync(summaryPath);
    }
  });

  test('should NOT include summary when too long (>300 chars)', async () => {
    const archivePath = '/tmp/test-archive.jsonl';
    fs.writeFileSync(archivePath, 'line1\nline2\n');

    const longSummary = 'A'.repeat(301);

    const results: Array<SearchResult & { summary?: string }> = [
      {
        exchange: {
          id: '1',
          project: 'test-project',
          timestamp: '2025-01-15T10:00:00Z',
          userMessage: 'Question',
          assistantMessage: 'Answer',
          archivePath: archivePath,
          lineStart: 1,
          lineEnd: 5
        },
        similarity: 0.8,
        snippet: 'Question',
        summary: longSummary
      }
    ];

    try {
      const output = await formatResults(results);
      // Summary should not be in output if too long
      expect(output).not.toContain(longSummary.substring(0, 50));
    } finally {
      fs.unlinkSync(archivePath);
    }
  });

  test('should include tool calls when present', async () => {
    const archivePath = '/tmp/test-archive.jsonl';
    fs.writeFileSync(archivePath, 'line1\nline2\n');

    const results: SearchResult[] = [
      {
        exchange: {
          id: '1',
          project: 'test-project',
          timestamp: '2025-01-15T10:00:00Z',
          userMessage: 'Question',
          assistantMessage: 'Answer',
          archivePath: archivePath,
          lineStart: 1,
          lineEnd: 5,
          toolCalls: [
            {
              id: 'tool-1',
              exchangeId: '1',
              toolName: 'Bash',
              toolInput: { command: 'ls' },
              isError: false,
              timestamp: '2025-01-15T10:00:00Z'
            },
            {
              id: 'tool-2',
              exchangeId: '1',
              toolName: 'Read',
              toolInput: { file_path: '/tmp/file.txt' },
              isError: false,
              timestamp: '2025-01-15T10:01:00Z'
            }
          ]
        },
        similarity: 0.8,
        snippet: 'Question'
      }
    ];

    try {
      const output = await formatResults(results);
      expect(output).toContain('Tools:');
      expect(output).toContain('Bash(1)');
      expect(output).toContain('Read(1)');
    } finally {
      fs.unlinkSync(archivePath);
    }
  });

  test('should handle text mode results without similarity', async () => {
    const archivePath = '/tmp/test-archive.jsonl';
    fs.writeFileSync(archivePath, 'line1\nline2\n');

    const results: SearchResult[] = [
      {
        exchange: {
          id: '1',
          project: 'test-project',
          timestamp: '2025-01-15T10:00:00Z',
          userMessage: 'Question',
          assistantMessage: 'Answer',
          archivePath: archivePath,
          lineStart: 1,
          lineEnd: 5
        },
        similarity: undefined,
        snippet: 'Question'
      }
    ];

    try {
      const output = await formatResults(results);
      expect(output).toContain('[test-project, 2025-01-15]');
      expect(output).not.toContain('% match');
    } finally {
      fs.unlinkSync(archivePath);
    }
  });

  test('should truncate long user messages in snippet', async () => {
    const archivePath = '/tmp/test-archive.jsonl';
    fs.writeFileSync(archivePath, 'line1\nline2\n');

    const longMessage = 'A'.repeat(300);

    const results: SearchResult[] = [
      {
        exchange: {
          id: '1',
          project: 'test-project',
          timestamp: '2025-01-15T10:00:00Z',
          userMessage: longMessage,
          assistantMessage: 'Answer',
          archivePath: archivePath,
          lineStart: 1,
          lineEnd: 5
        },
        similarity: 0.8,
        snippet: longMessage.substring(0, 200) + '...'
      }
    ];

    try {
      const output = await formatResults(results);
      expect(output).toContain('...');
    } finally {
      fs.unlinkSync(archivePath);
    }
  });
});

describe('searchMultipleConcepts', () => {
  // Note: These tests use the actual implementation but with text mode
  // since vector mode requires sqlite-vec which doesn't work with bun:sqlite
  test('should return empty array for empty concepts', async () => {
    const results = await searchMultipleConcepts([], {});
    expect(results).toEqual([]);
  });

  // The remaining searchMultipleConcepts tests are skipped for bun testing
  // because vector search requires sqlite-vec which doesn't work with bun:sqlite
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
  test('should return message for empty results', async () => {
    const output = await formatMultiConceptResults([], ['auth', 'security']);
    expect(output).toContain('No conversations found matching all concepts');
    expect(output).toContain('auth, security');
  });

  test('should format multi-concept results', async () => {
    const archivePath = '/tmp/test-multi.jsonl';
    fs.writeFileSync(archivePath, 'line1\nline2\n');

    const results: MultiConceptResult[] = [
      {
        exchange: {
          id: '1',
          project: 'test-project',
          timestamp: '2025-01-15T10:00:00Z',
          userMessage: 'How to implement authentication?',
          assistantMessage: 'Use JWT',
          archivePath: archivePath,
          lineStart: 1,
          lineEnd: 10
        },
        snippet: 'How to implement authentication?',
        conceptSimilarities: [0.85, 0.72],
        averageSimilarity: 0.785
      }
    ];

    try {
      const output = await formatMultiConceptResults(results, ['authentication', 'JWT']);
      expect(output).toContain('Found 1 conversation matching all concepts');
      expect(output).toContain('[authentication + JWT]');
      expect(output).toContain('79% avg match');
      expect(output).toContain('authentication: 85%');
      expect(output).toContain('JWT: 72%');
    } finally {
      fs.unlinkSync(archivePath);
    }
  });

  test('should include tool calls in multi-concept format', async () => {
    const archivePath = '/tmp/test-multi.jsonl';
    fs.writeFileSync(archivePath, 'line1\nline2\n');

    const results: MultiConceptResult[] = [
      {
        exchange: {
          id: '1',
          project: 'test-project',
          timestamp: '2025-01-15T10:00:00Z',
          userMessage: 'Question',
          assistantMessage: 'Answer',
          archivePath: archivePath,
          lineStart: 1,
          lineEnd: 10,
          toolCalls: [
            {
              id: 't1',
              exchangeId: '1',
              toolName: 'Bash',
              toolInput: { command: 'ls' },
              isError: false,
              timestamp: '2025-01-15T10:00:00Z'
            }
          ]
        },
        snippet: 'Question',
        conceptSimilarities: [0.8],
        averageSimilarity: 0.8
      }
    ];

    try {
      const output = await formatMultiConceptResults(results, ['concept1']);
      expect(output).toContain('Tools:');
      expect(output).toContain('Bash(1)');
    } finally {
      fs.unlinkSync(archivePath);
    }
  });
});

describe('Helper functions - getFileSizeInKB and countLines', () => {
  // These are tested indirectly through formatResults, but let's add edge cases

  test('should handle non-existent archive file gracefully', async () => {
    const archivePath = '/tmp/non-existent-archive-xyz.jsonl';

    const results: SearchResult[] = [
      {
        exchange: {
          id: '1',
          project: 'test-project',
          timestamp: '2025-01-15T10:00:00Z',
          userMessage: 'Question',
          assistantMessage: 'Answer',
          archivePath: archivePath,
          lineStart: 1,
          lineEnd: 5
        },
        similarity: 0.8,
        snippet: 'Question'
      }
    ];

    // Should not throw, just handle gracefully
    const output = await formatResults(results);
    expect(output).toBeDefined();
  });

  test('should count lines correctly', async () => {
    const archivePath = '/tmp/test-lines.jsonl';
    const content = 'line1\nline2\nline3\nline4\n\nline5\n'; // 5 non-empty lines
    fs.writeFileSync(archivePath, content);

    const results: SearchResult[] = [
      {
        exchange: {
          id: '1',
          project: 'test-project',
          timestamp: '2025-01-15T10:00:00Z',
          userMessage: 'Question',
          assistantMessage: 'Answer',
          archivePath: archivePath,
          lineStart: 1,
          lineEnd: 5
        },
        similarity: 0.8,
        snippet: 'Question'
      }
    ];

    try {
      const output = await formatResults(results);
      expect(output).toContain('5 lines');
    } finally {
      fs.unlinkSync(archivePath);
    }
  });

  test('should calculate file size in KB', async () => {
    const archivePath = '/tmp/test-size.jsonl';
    const content = 'A'.repeat(2048); // 2KB
    fs.writeFileSync(archivePath, content);

    const results: SearchResult[] = [
      {
        exchange: {
          id: '1',
          project: 'test-project',
          timestamp: '2025-01-15T10:00:00Z',
          userMessage: 'Question',
          assistantMessage: 'Answer',
          archivePath: archivePath,
          lineStart: 1,
          lineEnd: 5
        },
        similarity: 0.8,
        snippet: 'Question'
      }
    ];

    try {
      const output = await formatResults(results);
      expect(output).toContain('2KB');
    } finally {
      fs.unlinkSync(archivePath);
    }
  });

  test('should round file size to one decimal place', async () => {
    const archivePath = '/tmp/test-round.jsonl';
    const content = 'A'.repeat(1536); // 1.5KB
    fs.writeFileSync(archivePath, content);

    const results: SearchResult[] = [
      {
        exchange: {
          id: '1',
          project: 'test-project',
          timestamp: '2025-01-15T10:00:00Z',
          userMessage: 'Question',
          assistantMessage: 'Answer',
          archivePath: archivePath,
          lineStart: 1,
          lineEnd: 5
        },
        similarity: 0.8,
        snippet: 'Question'
      }
    ];

    try {
      const output = await formatResults(results);
      expect(output).toContain('1.5KB');
    } finally {
      fs.unlinkSync(archivePath);
    }
  });
});
