/**
 * Tests for stats.ts - Statistics gathering and formatting
 *
 * NOTE: These tests require vitest/Node.js because getIndexStats uses better-sqlite3
 * which is a native module not supported by Bun. To run these tests:
 *
 *   npx vitest run plugins/conversation-memory/src/core/stats.test.ts
 *
 * The formatStats tests can run with Bun since they don't require a database.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Import functions to test
import { getIndexStats, formatStats, type IndexStats } from './stats.js';

// Helper to create a test database with proper schema
let testDbPath: string;
let testArchiveDir: string;
let testDb: Database;

function createTestDatabase(): Database {
  testDbPath = path.join(tmpdir(), `test-stats-${Date.now()}.db`);
  testArchiveDir = path.join(tmpdir(), `test-archive-${Date.now()}`);
  fs.mkdirSync(testArchiveDir, { recursive: true });

  const db = new Database(testDbPath, { create: true });

  // Create exchanges table
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

  return db;
}

function cleanupTestDatabase(): void {
  if (testDb) {
    testDb.close();
  }
  if (testDbPath && fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (testArchiveDir && fs.existsSync(testArchiveDir)) {
    fs.rmSync(testArchiveDir, { recursive: true, force: true });
  }
}

// Helper to insert test exchange
function insertTestExchange(
  db: Database.Database,
  exchange: {
    id: string;
    project: string;
    timestamp: string;
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
    'Test user message',
    'Test assistant message',
    exchange.archivePath,
    exchange.lineStart,
    exchange.lineEnd
  );
}

// Helper to create a test summary file
function createSummaryFile(archivePath: string): void {
  const summaryPath = archivePath.replace('.jsonl', '-summary.txt');
  fs.writeFileSync(summaryPath, 'Test summary content');
}

describe('getIndexStats', () => {
  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  describe('with non-existent database', () => {
    test('should return empty stats when database does not exist', async () => {
      const nonExistentPath = path.join(tmpdir(), `non-existent-${Date.now()}.db`);
      const stats = await getIndexStats(nonExistentPath);

      expect(stats.totalConversations).toBe(0);
      expect(stats.conversationsWithSummaries).toBe(0);
      expect(stats.conversationsWithoutSummaries).toBe(0);
      expect(stats.totalExchanges).toBe(0);
      expect(stats.projectCount).toBe(0);
      // Non-existent database doesn't have topProjects or dateRange
      expect(stats.topProjects).toBeUndefined();
      expect(stats.dateRange).toBeUndefined();
    });

    test('should not throw error for missing database', async () => {
      const nonExistentPath = path.join(tmpdir(), `non-existent-${Date.now()}.db`);

      expect(async () => {
        await getIndexStats(nonExistentPath);
      }).not.toThrow();
    });
  });

  describe('with empty database', () => {
    test('should return empty stats when database has no exchanges table', async () => {
      // Create database without exchanges table
      const emptyDbPath = path.join(tmpdir(), `empty-${Date.now()}.db`);
      const emptyDb = new Database(emptyDbPath);
      emptyDb.close();

      const stats = await getIndexStats(emptyDbPath);

      expect(stats.totalConversations).toBe(0);
      expect(stats.conversationsWithSummaries).toBe(0);
      expect(stats.conversationsWithoutSummaries).toBe(0);
      expect(stats.totalExchanges).toBe(0);
      expect(stats.projectCount).toBe(0);
      // Database without exchanges table doesn't have topProjects or dateRange
      expect(stats.topProjects).toBeUndefined();
      expect(stats.dateRange).toBeUndefined();

      // Cleanup
      fs.unlinkSync(emptyDbPath);
    });

    test('should return empty stats when exchanges table exists but is empty', async () => {
      // testDb already has exchanges table from createTestDatabase
      const stats = await getIndexStats(testDbPath);

      expect(stats.totalConversations).toBe(0);
      expect(stats.conversationsWithSummaries).toBe(0);
      expect(stats.conversationsWithoutSummaries).toBe(0);
      expect(stats.totalExchanges).toBe(0);
      expect(stats.projectCount).toBe(0);
      // When there's no data, topProjects is an empty array
      expect(stats.topProjects).toEqual([]);
      // When there are no exchanges, dateRange is undefined
      expect(stats.dateRange).toBeUndefined();
    });
  });

  describe('conversation counts', () => {
    test('should return correct count of unique conversations', async () => {
      // Insert exchanges from 3 different conversations
      insertTestExchange(testDb, {
        id: '1',
        project: 'test-project',
        timestamp: '2024-01-01T10:00:00Z',
        archivePath: '/archive/conv1.jsonl',
        lineStart: 1,
        lineEnd: 10,
      });

      insertTestExchange(testDb, {
        id: '2',
        project: 'test-project',
        timestamp: '2024-01-01T11:00:00Z',
        archivePath: '/archive/conv1.jsonl', // Same conversation
        lineStart: 11,
        lineEnd: 20,
      });

      insertTestExchange(testDb, {
        id: '3',
        project: 'test-project',
        timestamp: '2024-01-02T10:00:00Z',
        archivePath: '/archive/conv2.jsonl',
        lineStart: 1,
        lineEnd: 10,
      });

      insertTestExchange(testDb, {
        id: '4',
        project: 'test-project',
        timestamp: '2024-01-03T10:00:00Z',
        archivePath: '/archive/conv3.jsonl',
        lineStart: 1,
        lineEnd: 10,
      });

      const stats = await getIndexStats(testDbPath);

      expect(stats.totalConversations).toBe(3);
    });

    test('should return correct count of total exchanges', async () => {
      insertTestExchange(testDb, {
        id: '1',
        project: 'test-project',
        timestamp: '2024-01-01T10:00:00Z',
        archivePath: '/archive/conv1.jsonl',
        lineStart: 1,
        lineEnd: 10,
      });

      insertTestExchange(testDb, {
        id: '2',
        project: 'test-project',
        timestamp: '2024-01-01T11:00:00Z',
        archivePath: '/archive/conv1.jsonl',
        lineStart: 11,
        lineEnd: 20,
      });

      insertTestExchange(testDb, {
        id: '3',
        project: 'test-project',
        timestamp: '2024-01-02T10:00:00Z',
        archivePath: '/archive/conv2.jsonl',
        lineStart: 1,
        lineEnd: 10,
      });

      const stats = await getIndexStats(testDbPath);

      expect(stats.totalExchanges).toBe(3);
    });
  });

  describe('summary file detection', () => {
    test('should count conversations with summaries', async () => {
      // Create actual archive files
      const archivePath1 = path.join(testArchiveDir, 'conv1.jsonl');
      const archivePath2 = path.join(testArchiveDir, 'conv2.jsonl');
      const archivePath3 = path.join(testArchiveDir, 'conv3.jsonl');

      fs.writeFileSync(archivePath1, 'test data');
      fs.writeFileSync(archivePath2, 'test data');
      fs.writeFileSync(archivePath3, 'test data');

      // Create summary files for conv1 and conv2
      createSummaryFile(archivePath1);
      createSummaryFile(archivePath2);
      // conv3 has no summary

      insertTestExchange(testDb, {
        id: '1',
        project: 'test-project',
        timestamp: '2024-01-01T10:00:00Z',
        archivePath: archivePath1,
        lineStart: 1,
        lineEnd: 10,
      });

      insertTestExchange(testDb, {
        id: '2',
        project: 'test-project',
        timestamp: '2024-01-02T10:00:00Z',
        archivePath: archivePath2,
        lineStart: 1,
        lineEnd: 10,
      });

      insertTestExchange(testDb, {
        id: '3',
        project: 'test-project',
        timestamp: '2024-01-03T10:00:00Z',
        archivePath: archivePath3,
        lineStart: 1,
        lineEnd: 10,
      });

      const stats = await getIndexStats(testDbPath);

      expect(stats.conversationsWithSummaries).toBe(2);
      expect(stats.conversationsWithoutSummaries).toBe(1);
      expect(stats.totalConversations).toBe(3);
    });

    test('should handle all conversations with summaries', async () => {
      const archivePath1 = path.join(testArchiveDir, 'conv1.jsonl');
      const archivePath2 = path.join(testArchiveDir, 'conv2.jsonl');

      fs.writeFileSync(archivePath1, 'test data');
      fs.writeFileSync(archivePath2, 'test data');

      createSummaryFile(archivePath1);
      createSummaryFile(archivePath2);

      insertTestExchange(testDb, {
        id: '1',
        project: 'test-project',
        timestamp: '2024-01-01T10:00:00Z',
        archivePath: archivePath1,
        lineStart: 1,
        lineEnd: 10,
      });

      insertTestExchange(testDb, {
        id: '2',
        project: 'test-project',
        timestamp: '2024-01-02T10:00:00Z',
        archivePath: archivePath2,
        lineStart: 1,
        lineEnd: 10,
      });

      const stats = await getIndexStats(testDbPath);

      expect(stats.conversationsWithSummaries).toBe(2);
      expect(stats.conversationsWithoutSummaries).toBe(0);
    });

    test('should handle all conversations without summaries', async () => {
      const archivePath1 = path.join(testArchiveDir, 'conv1.jsonl');
      const archivePath2 = path.join(testArchiveDir, 'conv2.jsonl');

      fs.writeFileSync(archivePath1, 'test data');
      fs.writeFileSync(archivePath2, 'test data');

      // No summary files created

      insertTestExchange(testDb, {
        id: '1',
        project: 'test-project',
        timestamp: '2024-01-01T10:00:00Z',
        archivePath: archivePath1,
        lineStart: 1,
        lineEnd: 10,
      });

      insertTestExchange(testDb, {
        id: '2',
        project: 'test-project',
        timestamp: '2024-01-02T10:00:00Z',
        archivePath: archivePath2,
        lineStart: 1,
        lineEnd: 10,
      });

      const stats = await getIndexStats(testDbPath);

      expect(stats.conversationsWithSummaries).toBe(0);
      expect(stats.conversationsWithoutSummaries).toBe(2);
    });
  });

  describe('date range', () => {
    test('should return earliest and latest timestamps', async () => {
      insertTestExchange(testDb, {
        id: '1',
        project: 'test-project',
        timestamp: '2024-01-15T10:00:00Z',
        archivePath: path.join(testArchiveDir, 'conv1.jsonl'),
        lineStart: 1,
        lineEnd: 10,
      });

      insertTestExchange(testDb, {
        id: '2',
        project: 'test-project',
        timestamp: '2024-01-10T09:00:00Z', // Earlier
        archivePath: path.join(testArchiveDir, 'conv2.jsonl'),
        lineStart: 1,
        lineEnd: 10,
      });

      insertTestExchange(testDb, {
        id: '3',
        project: 'test-project',
        timestamp: '2024-01-20T15:00:00Z', // Later
        archivePath: path.join(testArchiveDir, 'conv3.jsonl'),
        lineStart: 1,
        lineEnd: 10,
      });

      const stats = await getIndexStats(testDbPath);

      expect(stats.dateRange).toBeDefined();
      expect(stats.dateRange?.earliest).toBe('2024-01-10T09:00:00Z');
      expect(stats.dateRange?.latest).toBe('2024-01-20T15:00:00Z');
    });

    test('should handle single exchange date range', async () => {
      insertTestExchange(testDb, {
        id: '1',
        project: 'test-project',
        timestamp: '2024-01-15T10:00:00Z',
        archivePath: path.join(testArchiveDir, 'conv1.jsonl'),
        lineStart: 1,
        lineEnd: 10,
      });

      const stats = await getIndexStats(testDbPath);

      expect(stats.dateRange).toBeDefined();
      expect(stats.dateRange?.earliest).toBe('2024-01-15T10:00:00Z');
      expect(stats.dateRange?.latest).toBe('2024-01-15T10:00:00Z');
    });

    test('should not include dateRange when no exchanges exist', async () => {
      const stats = await getIndexStats(testDbPath);

      expect(stats.dateRange).toBeUndefined();
    });
  });

  describe('project statistics', () => {
    test('should return correct project count', async () => {
      insertTestExchange(testDb, {
        id: '1',
        project: 'project-a',
        timestamp: '2024-01-01T10:00:00Z',
        archivePath: path.join(testArchiveDir, 'conv1.jsonl'),
        lineStart: 1,
        lineEnd: 10,
      });

      insertTestExchange(testDb, {
        id: '2',
        project: 'project-b',
        timestamp: '2024-01-02T10:00:00Z',
        archivePath: path.join(testArchiveDir, 'conv2.jsonl'),
        lineStart: 1,
        lineEnd: 10,
      });

      insertTestExchange(testDb, {
        id: '3',
        project: 'project-c',
        timestamp: '2024-01-03T10:00:00Z',
        archivePath: path.join(testArchiveDir, 'conv3.jsonl'),
        lineStart: 1,
        lineEnd: 10,
      });

      const stats = await getIndexStats(testDbPath);

      expect(stats.projectCount).toBe(3);
    });

    test('should return top projects by conversation count', async () => {
      // Project A: 5 conversations
      for (let i = 1; i <= 5; i++) {
        insertTestExchange(testDb, {
          id: `a-${i}`,
          project: 'project-a',
          timestamp: `2024-01-0${i}T10:00:00Z`,
          archivePath: path.join(testArchiveDir, `conv-a-${i}.jsonl`),
          lineStart: 1,
          lineEnd: 10,
        });
      }

      // Project B: 3 conversations
      for (let i = 1; i <= 3; i++) {
        insertTestExchange(testDb, {
          id: `b-${i}`,
          project: 'project-b',
          timestamp: `2024-02-0${i}T10:00:00Z`,
          archivePath: path.join(testArchiveDir, `conv-b-${i}.jsonl`),
          lineStart: 1,
          lineEnd: 10,
        });
      }

      // Project C: 2 conversations
      for (let i = 1; i <= 2; i++) {
        insertTestExchange(testDb, {
          id: `c-${i}`,
          project: 'project-c',
          timestamp: `2024-03-0${i}T10:00:00Z`,
          archivePath: path.join(testArchiveDir, `conv-c-${i}.jsonl`),
          lineStart: 1,
          lineEnd: 10,
        });
      }

      const stats = await getIndexStats(testDbPath);

      expect(stats.topProjects).toBeDefined();
      expect(stats.topProjects).toHaveLength(3);
      expect(stats.topProjects?.[0]).toEqual({ project: 'project-a', count: 5 });
      expect(stats.topProjects?.[1]).toEqual({ project: 'project-b', count: 3 });
      expect(stats.topProjects?.[2]).toEqual({ project: 'project-c', count: 2 });
    });

    test('should limit top projects to 10', async () => {
      // Create 15 projects
      for (let i = 1; i <= 15; i++) {
        insertTestExchange(testDb, {
          id: `${i}`,
          project: `project-${i.toString().padStart(2, '0')}`,
          timestamp: `2024-01-${i.toString().padStart(2, '0')}T10:00:00Z`,
          archivePath: path.join(testArchiveDir, `conv-${i}.jsonl`),
          lineStart: 1,
          lineEnd: 10,
        });
      }

      const stats = await getIndexStats(testDbPath);

      expect(stats.topProjects).toBeDefined();
      expect(stats.topProjects).toHaveLength(10);
    });

    test('should handle projects with null/empty project names', async () => {
      insertTestExchange(testDb, {
        id: '1',
        project: '',
        timestamp: '2024-01-01T10:00:00Z',
        archivePath: path.join(testArchiveDir, 'conv1.jsonl'),
        lineStart: 1,
        lineEnd: 10,
      });

      insertTestExchange(testDb, {
        id: '2',
        project: 'test-project',
        timestamp: '2024-01-02T10:00:00Z',
        archivePath: path.join(testArchiveDir, 'conv2.jsonl'),
        lineStart: 1,
        lineEnd: 10,
      });

      const stats = await getIndexStats(testDbPath);

      // Empty project names should still be counted
      expect(stats.projectCount).toBe(2);
    });
  });

  describe('database cleanup', () => {
    test('should close database connection after reading stats', async () => {
      insertTestExchange(testDb, {
        id: '1',
        project: 'test-project',
        timestamp: '2024-01-01T10:00:00Z',
        archivePath: path.join(testArchiveDir, 'conv1.jsonl'),
        lineStart: 1,
        lineEnd: 10,
      });

      const stats = await getIndexStats(testDbPath);

      expect(stats.totalConversations).toBe(1);

      // Try to delete the database file - should work if connection is closed
      expect(() => {
        fs.unlinkSync(testDbPath);
      }).not.toThrow();

      // Recreate for cleanup
      testDbPath = path.join(tmpdir(), `test-stats-${Date.now()}.db`);
    });
  });
});

describe('formatStats', () => {
  test('should format empty stats correctly', () => {
    const emptyStats: IndexStats = {
      totalConversations: 0,
      conversationsWithSummaries: 0,
      conversationsWithoutSummaries: 0,
      totalExchanges: 0,
      projectCount: 0,
    };

    const output = formatStats(emptyStats);

    expect(output).toContain('Episodic Memory Index Statistics');
    expect(output).toContain('Total Conversations: 0');
    expect(output).toContain('Total Exchanges: 0');
    expect(output).toContain('With Summaries: 0');
    expect(output).toContain('Without Summaries: 0');
    expect(output).toContain('Unique Projects: 0');
  });

  test('should format stats with conversations and exchanges', () => {
    const stats: IndexStats = {
      totalConversations: 100,
      conversationsWithSummaries: 80,
      conversationsWithoutSummaries: 20,
      totalExchanges: 500,
      projectCount: 5,
    };

    const output = formatStats(stats);

    expect(output).toContain('Total Conversations: 100');
    expect(output).toContain('Total Exchanges: 500');
    expect(output).toContain('With Summaries: 80');
    expect(output).toContain('Without Summaries: 20');
  });

  test('should format numbers with locale separators', () => {
    const stats: IndexStats = {
      totalConversations: 1000,
      conversationsWithSummaries: 800,
      conversationsWithoutSummaries: 200,
      totalExchanges: 5000,
      projectCount: 10,
    };

    const output = formatStats(stats);

    expect(output).toContain('Total Conversations: 1,000');
    expect(output).toContain('Total Exchanges: 5,000');
  });

  test('should show percentage when conversations are missing summaries', () => {
    const stats: IndexStats = {
      totalConversations: 100,
      conversationsWithSummaries: 75,
      conversationsWithoutSummaries: 25,
      totalExchanges: 500,
      projectCount: 5,
    };

    const output = formatStats(stats);

    expect(output).toContain('(25.0% missing summaries)');
  });

  test('should not show percentage when all conversations have summaries', () => {
    const stats: IndexStats = {
      totalConversations: 100,
      conversationsWithSummaries: 100,
      conversationsWithoutSummaries: 0,
      totalExchanges: 500,
      projectCount: 5,
    };

    const output = formatStats(stats);

    expect(output).not.toContain('missing summaries');
  });

  test('should format date range', () => {
    const stats: IndexStats = {
      totalConversations: 50,
      conversationsWithSummaries: 40,
      conversationsWithoutSummaries: 10,
      totalExchanges: 200,
      dateRange: {
        earliest: '2024-01-01T10:00:00Z',
        latest: '2024-12-31T23:59:59Z',
      },
      projectCount: 3,
    };

    const output = formatStats(stats);

    expect(output).toContain('Date Range:');
    expect(output).toContain('Earliest:');
    expect(output).toContain('Latest:');
  });

  test('should not include date range section when dateRange is undefined', () => {
    const stats: IndexStats = {
      totalConversations: 50,
      conversationsWithSummaries: 40,
      conversationsWithoutSummaries: 10,
      totalExchanges: 200,
      projectCount: 3,
    };

    const output = formatStats(stats);

    expect(output).not.toContain('Date Range:');
  });

  test('should format top projects list', () => {
    const stats: IndexStats = {
      totalConversations: 100,
      conversationsWithSummaries: 80,
      conversationsWithoutSummaries: 20,
      totalExchanges: 500,
      projectCount: 5,
      topProjects: [
        { project: 'project-a', count: 50 },
        { project: 'project-b', count: 30 },
        { project: 'project-c', count: 15 },
        { project: 'project-d', count: 5 },
      ],
    };

    const output = formatStats(stats);

    expect(output).toContain('Top Projects by Conversation Count:');
    expect(output).toContain('  50 - project-a');
    expect(output).toContain('  30 - project-b');
    expect(output).toContain('  15 - project-c');
    expect(output).toContain('   5 - project-d');
  });

  test('should display (unknown) for empty project names', () => {
    const stats: IndexStats = {
      totalConversations: 10,
      conversationsWithSummaries: 5,
      conversationsWithoutSummaries: 5,
      totalExchanges: 50,
      projectCount: 2,
      topProjects: [
        { project: 'project-a', count: 8 },
        { project: '', count: 2 },
      ],
    };

    const output = formatStats(stats);

    expect(output).toContain('   8 - project-a');
    expect(output).toContain('   2 - (unknown)');
  });

  test('should not include top projects section when no projects', () => {
    const stats: IndexStats = {
      totalConversations: 0,
      conversationsWithSummaries: 0,
      conversationsWithoutSummaries: 0,
      totalExchanges: 0,
      projectCount: 0,
    };

    const output = formatStats(stats);

    expect(output).not.toContain('Top Projects');
  });

  test('should not include top projects section when topProjects is empty array', () => {
    const stats: IndexStats = {
      totalConversations: 10,
      conversationsWithSummaries: 5,
      conversationsWithoutSummaries: 5,
      totalExchanges: 50,
      projectCount: 2,
      topProjects: [],
    };

    const output = formatStats(stats);

    expect(output).not.toContain('Top Projects');
  });

  test('should pad project counts for alignment', () => {
    const stats: IndexStats = {
      totalConversations: 100,
      conversationsWithSummaries: 80,
      conversationsWithoutSummaries: 20,
      totalExchanges: 500,
      projectCount: 3,
      topProjects: [
        { project: 'project-a', count: 100 },
        { project: 'project-b', count: 50 },
        { project: 'project-c', count: 5 },
      ],
    };

    const output = formatStats(stats);

    // All counts should be padded to 4 characters
    expect(output).toContain(' 100 - project-a');
    expect(output).toContain('  50 - project-b');
    expect(output).toContain('   5 - project-c');
  });

  test('should include header and separator', () => {
    const stats: IndexStats = {
      totalConversations: 10,
      conversationsWithSummaries: 5,
      conversationsWithoutSummaries: 5,
      totalExchanges: 50,
      projectCount: 2,
    };

    const output = formatStats(stats);

    expect(output).toContain('Episodic Memory Index Statistics');
    expect(output).toContain('='.repeat(50));
  });
});
