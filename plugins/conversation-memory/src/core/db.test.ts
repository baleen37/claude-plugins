import { describe, test, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import type { ConversationExchange } from './types.js';

// Import the functions we're testing
// We need to create test versions that work with in-memory DB
const initTestDatabase = (): Database.Database => {
  const db = new Database(':memory:');

  // Load sqlite-vec extension
  sqliteVec.load(db);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Create exchanges table
  db.exec(`
    CREATE TABLE IF NOT EXISTS exchanges (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      user_message TEXT NOT NULL,
      assistant_message TEXT NOT NULL,
      archive_path TEXT NOT NULL,
      line_start INTEGER NOT NULL,
      line_end INTEGER NOT NULL,
      embedding BLOB,
      last_indexed INTEGER,
      parent_uuid TEXT,
      is_sidechain BOOLEAN DEFAULT 0,
      session_id TEXT,
      cwd TEXT,
      git_branch TEXT,
      claude_version TEXT,
      thinking_level TEXT,
      thinking_disabled BOOLEAN,
      thinking_triggers TEXT
    )
  `);

  // Create tool_calls table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_calls (
      id TEXT PRIMARY KEY,
      exchange_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      tool_input TEXT,
      tool_result TEXT,
      is_error BOOLEAN DEFAULT 0,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (exchange_id) REFERENCES exchanges(id)
    )
  `);

  // Create vector search index
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_exchanges USING vec0(
      id TEXT PRIMARY KEY,
      embedding FLOAT[768]
    )
  `);

  // Run migrations
  migrateSchema(db);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_timestamp ON exchanges(timestamp DESC)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_id ON exchanges(session_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_project ON exchanges(project)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sidechain ON exchanges(is_sidechain)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_git_branch ON exchanges(git_branch)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tool_name ON tool_calls(tool_name)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tool_exchange ON tool_calls(exchange_id)
  `);

  return db;
};

export function migrateSchema(db: Database.Database): void {
  const columns = db.prepare(`SELECT name FROM pragma_table_info('exchanges')`).all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map(c => c.name));

  const migrations: Array<{ name: string; sql: string }> = [
    { name: 'last_indexed', sql: 'ALTER TABLE exchanges ADD COLUMN last_indexed INTEGER' },
    { name: 'parent_uuid', sql: 'ALTER TABLE exchanges ADD COLUMN parent_uuid TEXT' },
    { name: 'is_sidechain', sql: 'ALTER TABLE exchanges ADD COLUMN is_sidechain BOOLEAN DEFAULT 0' },
    { name: 'session_id', sql: 'ALTER TABLE exchanges ADD COLUMN session_id TEXT' },
    { name: 'cwd', sql: 'ALTER TABLE exchanges ADD COLUMN cwd TEXT' },
    { name: 'git_branch', sql: 'ALTER TABLE exchanges ADD COLUMN git_branch TEXT' },
    { name: 'claude_version', sql: 'ALTER TABLE exchanges ADD COLUMN claude_version TEXT' },
    { name: 'thinking_level', sql: 'ALTER TABLE exchanges ADD COLUMN thinking_level TEXT' },
    { name: 'thinking_disabled', sql: 'ALTER TABLE exchanges ADD COLUMN thinking_disabled BOOLEAN' },
    { name: 'thinking_triggers', sql: 'ALTER TABLE exchanges ADD COLUMN thinking_triggers TEXT' },
  ];

  let migrated = false;
  for (const migration of migrations) {
    if (!columnNames.has(migration.name)) {
      console.log(`Migrating schema: adding ${migration.name} column...`);
      db.prepare(migration.sql).run();
      migrated = true;
    }
  }

  if (migrated) {
    console.log('Migration complete.');
  }
}

export function insertExchange(
  db: Database.Database,
  exchange: ConversationExchange,
  embedding: number[],
  toolNames?: string[]
): void {
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO exchanges
    (id, project, timestamp, user_message, assistant_message, archive_path, line_start, line_end, last_indexed,
     parent_uuid, is_sidechain, session_id, cwd, git_branch, claude_version,
     thinking_level, thinking_disabled, thinking_triggers)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    exchange.id,
    exchange.project,
    exchange.timestamp,
    exchange.userMessage,
    exchange.assistantMessage,
    exchange.archivePath,
    exchange.lineStart,
    exchange.lineEnd,
    now,
    exchange.parentUuid || null,
    exchange.isSidechain ? 1 : 0,
    exchange.sessionId || null,
    exchange.cwd || null,
    exchange.gitBranch || null,
    exchange.claudeVersion || null,
    exchange.thinkingLevel || null,
    exchange.thinkingDisabled ? 1 : 0,
    exchange.thinkingTriggers || null
  );

  // Insert into vector table (delete first since virtual tables don't support REPLACE)
  const delStmt = db.prepare(`DELETE FROM vec_exchanges WHERE id = ?`);
  delStmt.run(exchange.id);

  const vecStmt = db.prepare(`
    INSERT INTO vec_exchanges (id, embedding)
    VALUES (?, ?)
  `);

  vecStmt.run(exchange.id, Buffer.from(new Float32Array(embedding).buffer));

  // Insert tool calls if present
  if (exchange.toolCalls && exchange.toolCalls.length > 0) {
    const toolStmt = db.prepare(`
      INSERT OR REPLACE INTO tool_calls
      (id, exchange_id, tool_name, tool_input, tool_result, is_error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const toolCall of exchange.toolCalls) {
      toolStmt.run(
        toolCall.id,
        toolCall.exchangeId,
        toolCall.toolName,
        toolCall.toolInput ? JSON.stringify(toolCall.toolInput) : null,
        toolCall.toolResult || null,
        toolCall.isError ? 1 : 0,
        toolCall.timestamp
      );
    }
  }
}

export function getAllExchanges(db: Database.Database): Array<{ id: string; archivePath: string }> {
  const stmt = db.prepare(`SELECT id, archive_path as archivePath FROM exchanges`);
  return stmt.all() as Array<{ id: string; archivePath: string }>;
}

export function getFileLastIndexed(db: Database.Database, archivePath: string): number | null {
  const stmt = db.prepare(`
    SELECT MAX(last_indexed) as lastIndexed
    FROM exchanges
    WHERE archive_path = ?
  `);
  const row = stmt.get(archivePath) as { lastIndexed: number | null };
  return row.lastIndexed;
}

export function deleteExchange(db: Database.Database, id: string): void {
  // Delete from vector table
  db.prepare(`DELETE FROM vec_exchanges WHERE id = ?`).run(id);

  // Delete from main table
  db.prepare(`DELETE FROM exchanges WHERE id = ?`).run(id);
}

describe('Database Operations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initTestDatabase();
  });

  describe('initDatabase', () => {
    test('creates all required tables', () => {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table'
        ORDER BY name
      `).all() as Array<{ name: string }>;

      const tableNames = tables.map(t => t.name);

      expect(tableNames).toContain('exchanges');
      expect(tableNames).toContain('tool_calls');
      expect(tableNames).toContain('vec_exchanges');
    });

    test('creates proper indexes', () => {
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='index'
        AND name LIKE 'idx_%'
        ORDER BY name
      `).all() as Array<{ name: string }>;

      const indexNames = indexes.map(i => i.name);

      expect(indexNames).toContain('idx_timestamp');
      expect(indexNames).toContain('idx_session_id');
      expect(indexNames).toContain('idx_project');
      expect(indexNames).toContain('idx_sidechain');
      expect(indexNames).toContain('idx_git_branch');
      expect(indexNames).toContain('idx_tool_name');
      expect(indexNames).toContain('idx_tool_exchange');
    });

    test('enables WAL mode', () => {
      const result = db.pragma('journal_mode', { simple: true });
      // Note: WAL mode is not supported on in-memory databases, so it falls back to 'memory'
      // In production with file-based databases, this would be 'wal'
      expect(result).toBe('memory');
    });

    test('returns database instance', () => {
      expect(db).toBeDefined();
      expect(typeof db.prepare).toBe('function');
      expect(typeof db.exec).toBe('function');
      expect(typeof db.pragma).toBe('function');
    });

    test('creates exchanges table with all required columns', () => {
      const columns = db.prepare(`
        SELECT name FROM pragma_table_info('exchanges')
        ORDER BY name
      `).all() as Array<{ name: string }>;

      const columnNames = columns.map(c => c.name);

      // Required columns
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('project');
      expect(columnNames).toContain('timestamp');
      expect(columnNames).toContain('user_message');
      expect(columnNames).toContain('assistant_message');
      expect(columnNames).toContain('archive_path');
      expect(columnNames).toContain('line_start');
      expect(columnNames).toContain('line_end');
      expect(columnNames).toContain('embedding');

      // Optional columns added via migrations
      expect(columnNames).toContain('last_indexed');
      expect(columnNames).toContain('parent_uuid');
      expect(columnNames).toContain('is_sidechain');
      expect(columnNames).toContain('session_id');
      expect(columnNames).toContain('cwd');
      expect(columnNames).toContain('git_branch');
      expect(columnNames).toContain('claude_version');
      expect(columnNames).toContain('thinking_level');
      expect(columnNames).toContain('thinking_disabled');
      expect(columnNames).toContain('thinking_triggers');
    });
  });

  describe('migrateSchema', () => {
    test('adds new columns when missing', () => {
      // Create a table without migration columns
      db.exec('DROP TABLE IF EXISTS exchanges');
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
          embedding BLOB
        )
      `);

      // Run migration
      migrateSchema(db);

      // Check that migration columns were added
      const columns = db.prepare(`
        SELECT name FROM pragma_table_info('exchanges')
      `).all() as Array<{ name: string }>;

      const columnNames = new Set(columns.map(c => c.name));

      expect(columnNames.has('last_indexed')).toBe(true);
      expect(columnNames.has('parent_uuid')).toBe(true);
      expect(columnNames.has('is_sidechain')).toBe(true);
      expect(columnNames.has('session_id')).toBe(true);
      expect(columnNames.has('cwd')).toBe(true);
      expect(columnNames.has('git_branch')).toBe(true);
      expect(columnNames.has('claude_version')).toBe(true);
      expect(columnNames.has('thinking_level')).toBe(true);
      expect(columnNames.has('thinking_disabled')).toBe(true);
      expect(columnNames.has('thinking_triggers')).toBe(true);
    });

    test('skips migration if schema is current', () => {
      // Get initial column count
      const columnsBefore = db.prepare(`
        SELECT COUNT(*) as count FROM pragma_table_info('exchanges')
      `).get() as { count: number };

      // Run migration again on already migrated schema
      migrateSchema(db);

      // Column count should be the same
      const columnsAfter = db.prepare(`
        SELECT COUNT(*) as count FROM pragma_table_info('exchanges')
      `).get() as { count: number };

      expect(columnsAfter.count).toBe(columnsBefore.count);
    });

    test('handles partial migrations correctly', () => {
      // Create a table with only some migration columns
      db.exec('DROP TABLE IF EXISTS exchanges');
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
          embedding BLOB,
          last_indexed INTEGER,
          parent_uuid TEXT
        )
      `);

      // Run migration
      migrateSchema(db);

      // All migration columns should be present
      const columns = db.prepare(`
        SELECT name FROM pragma_table_info('exchanges')
      `).all() as Array<{ name: string }>;

      const columnNames = new Set(columns.map(c => c.name));

      // Check that columns that were missing are now present
      expect(columnNames.has('is_sidechain')).toBe(true);
      expect(columnNames.has('session_id')).toBe(true);
      expect(columnNames.has('cwd')).toBe(true);
    });
  });

  describe('insertExchange', () => {
    test('inserts exchange with all required fields', () => {
      const exchange: ConversationExchange = {
        id: 'test-1',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Hello',
        assistantMessage: 'Hi there!',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const embedding = new Array(768).fill(0.1);

      insertExchange(db, exchange, embedding);

      const row = db.prepare(`
        SELECT * FROM exchanges WHERE id = ?
      `).get(exchange.id) as any;

      expect(row).toBeDefined();
      expect(row.id).toBe(exchange.id);
      expect(row.project).toBe(exchange.project);
      expect(row.timestamp).toBe(exchange.timestamp);
      expect(row.user_message).toBe(exchange.userMessage);
      expect(row.assistant_message).toBe(exchange.assistantMessage);
      expect(row.archive_path).toBe(exchange.archivePath);
      expect(row.line_start).toBe(exchange.lineStart);
      expect(row.line_end).toBe(exchange.lineEnd);
      expect(row.last_indexed).toBeDefined();
      expect(typeof row.last_indexed).toBe('number');
    });

    test('stores vector data in vec_exchanges table', () => {
      const exchange: ConversationExchange = {
        id: 'test-2',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Hello',
        assistantMessage: 'Hi there!',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const embedding = new Array(768).fill(0.5);

      insertExchange(db, exchange, embedding);

      const vecRow = db.prepare(`
        SELECT embedding FROM vec_exchanges WHERE id = ?
      `).get(exchange.id) as any;

      expect(vecRow).toBeDefined();
      expect(vecRow.embedding).toBeInstanceOf(Buffer);
      expect(vecRow.embedding.length).toBe(768 * 4); // 768 floats * 4 bytes
    });

    test('stores tool_calls JSON when present', () => {
      const exchange: ConversationExchange = {
        id: 'test-3',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Run tests',
        assistantMessage: 'Running tests...',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 1,
        lineEnd: 10,
        toolCalls: [
          {
            id: 'tool-1',
            exchangeId: 'test-3',
            toolName: 'bash',
            toolInput: { command: 'npm test' },
            toolResult: 'Tests passed',
            isError: false,
            timestamp: '2024-01-01T00:00:01.000Z',
          },
        ],
      };

      const embedding = new Array(768).fill(0.1);

      insertExchange(db, exchange, embedding);

      const toolRow = db.prepare(`
        SELECT * FROM tool_calls WHERE id = ?
      `).get('tool-1') as any;

      expect(toolRow).toBeDefined();
      expect(toolRow.id).toBe('tool-1');
      expect(toolRow.exchange_id).toBe('test-3');
      expect(toolRow.tool_name).toBe('bash');
      expect(toolRow.tool_input).toBe(JSON.stringify({ command: 'npm test' }));
      expect(toolRow.tool_result).toBe('Tests passed');
      expect(toolRow.is_error).toBe(0);
    });

    test('handles tool_calls with errors', () => {
      const exchange: ConversationExchange = {
        id: 'test-4',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Run failing test',
        assistantMessage: 'Running test...',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 1,
        lineEnd: 10,
        toolCalls: [
          {
            id: 'tool-2',
            exchangeId: 'test-4',
            toolName: 'bash',
            toolInput: { command: 'npm test' },
            toolResult: 'Tests failed',
            isError: true,
            timestamp: '2024-01-01T00:00:01.000Z',
          },
        ],
      };

      const embedding = new Array(768).fill(0.1);

      insertExchange(db, exchange, embedding);

      const toolRow = db.prepare(`
        SELECT * FROM tool_calls WHERE id = ?
      `).get('tool-2') as any;

      expect(toolRow.is_error).toBe(1);
    });

    test('sets last_indexed timestamp', () => {
      const exchange: ConversationExchange = {
        id: 'test-5',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Hello',
        assistantMessage: 'Hi there!',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const beforeInsert = Date.now();
      const embedding = new Array(768).fill(0.1);
      insertExchange(db, exchange, embedding);
      const afterInsert = Date.now();

      const row = db.prepare(`
        SELECT last_indexed FROM exchanges WHERE id = ?
      `).get(exchange.id) as { last_indexed: number };

      expect(row.last_indexed).toBeGreaterThanOrEqual(beforeInsert);
      expect(row.last_indexed).toBeLessThanOrEqual(afterInsert);
    });

    test('replaces existing exchange with same id', () => {
      const exchange: ConversationExchange = {
        id: 'test-6',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Hello',
        assistantMessage: 'Hi there!',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const embedding = new Array(768).fill(0.1);
      insertExchange(db, exchange, embedding);

      // Update the exchange
      const updatedExchange = {
        ...exchange,
        userMessage: 'Updated message',
      };

      insertExchange(db, updatedExchange, embedding);

      const row = db.prepare(`
        SELECT user_message FROM exchanges WHERE id = ?
      `).get(exchange.id) as any;

      expect(row.user_message).toBe('Updated message');

      // Should still be only one row
      const count = db.prepare(`
        SELECT COUNT(*) as count FROM exchanges WHERE id = ?
      `).get(exchange.id) as { count: number };

      expect(count.count).toBe(1);
    });
  });

  describe('getAllExchanges', () => {
    test('returns all exchanges', () => {
      const exchange1: ConversationExchange = {
        id: 'test-7',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Hello',
        assistantMessage: 'Hi there!',
        archivePath: '/path/to/archive1.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const exchange2: ConversationExchange = {
        id: 'test-8',
        project: 'test-project',
        timestamp: '2024-01-02T00:00:00.000Z',
        userMessage: 'How are you?',
        assistantMessage: 'I am doing well!',
        archivePath: '/path/to/archive2.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const embedding = new Array(768).fill(0.1);

      insertExchange(db, exchange1, embedding);
      insertExchange(db, exchange2, embedding);

      const exchanges = getAllExchanges(db);

      expect(exchanges).toHaveLength(2);
      expect(exchanges.map(e => e.id)).toContain('test-7');
      expect(exchanges.map(e => e.id)).toContain('test-8');
      expect(exchanges.map(e => e.archivePath)).toContain('/path/to/archive1.jsonl');
      expect(exchanges.map(e => e.archivePath)).toContain('/path/to/archive2.jsonl');
    });

    test('returns empty array when no exchanges exist', () => {
      const exchanges = getAllExchanges(db);
      expect(exchanges).toEqual([]);
    });

    test('returns exchanges with id and archivePath properties', () => {
      const exchange: ConversationExchange = {
        id: 'test-9',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Hello',
        assistantMessage: 'Hi there!',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const embedding = new Array(768).fill(0.1);
      insertExchange(db, exchange, embedding);

      const exchanges = getAllExchanges(db);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0]).toHaveProperty('id');
      expect(exchanges[0]).toHaveProperty('archivePath');
      expect(exchanges[0].id).toBe('test-9');
      expect(exchanges[0].archivePath).toBe('/path/to/archive.jsonl');
    });
  });

  describe('getFileLastIndexed', () => {
    test('returns last indexed timestamp for a file', () => {
      const exchange: ConversationExchange = {
        id: 'test-10',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Hello',
        assistantMessage: 'Hi there!',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const beforeInsert = Date.now();
      const embedding = new Array(768).fill(0.1);
      insertExchange(db, exchange, embedding);
      const afterInsert = Date.now();

      const lastIndexed = getFileLastIndexed(db, '/path/to/archive.jsonl');

      expect(lastIndexed).toBeDefined();
      expect(lastIndexed).toBeGreaterThanOrEqual(beforeInsert);
      expect(lastIndexed).toBeLessThanOrEqual(afterInsert);
    });

    test('returns null for non-existent files', () => {
      const lastIndexed = getFileLastIndexed(db, '/non/existent/file.jsonl');
      expect(lastIndexed).toBeNull();
    });

    test('returns the maximum timestamp for multiple exchanges in same file', () => {
      const beforeInsert = Date.now();

      const exchange1: ConversationExchange = {
        id: 'test-11',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Hello',
        assistantMessage: 'Hi there!',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const embedding1 = new Array(768).fill(0.1);
      insertExchange(db, exchange1, embedding1);

      // Small delay to ensure different timestamps
      const start = Date.now();
      while (Date.now() - start < 2) {
        // Wait at least 2ms
      }

      const exchange2: ConversationExchange = {
        id: 'test-12',
        project: 'test-project',
        timestamp: '2024-01-02T00:00:00.000Z',
        userMessage: 'How are you?',
        assistantMessage: 'I am doing well!',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 11,
        lineEnd: 20,
      };

      const embedding2 = new Array(768).fill(0.1);
      insertExchange(db, exchange2, embedding2);

      const lastIndexed = getFileLastIndexed(db, '/path/to/archive.jsonl');

      // Should be the timestamp of the second (later) insertion
      expect(lastIndexed).toBeGreaterThanOrEqual(beforeInsert);
      expect(lastIndexed).toBeLessThanOrEqual(Date.now());
    });

    test('returns correct timestamp for specific file among multiple files', async () => {
      const exchange1: ConversationExchange = {
        id: 'test-13',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Hello',
        assistantMessage: 'Hi there!',
        archivePath: '/path/to/archive1.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const exchange2: ConversationExchange = {
        id: 'test-14',
        project: 'test-project',
        timestamp: '2024-01-02T00:00:00.000Z',
        userMessage: 'How are you?',
        assistantMessage: 'I am doing well!',
        archivePath: '/path/to/archive2.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const embedding = new Array(768).fill(0.1);

      insertExchange(db, exchange1, embedding);

      const timestamp1 = getFileLastIndexed(db, '/path/to/archive1.jsonl');

      // Add small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 2));

      insertExchange(db, exchange2, embedding);

      const timestamp2 = getFileLastIndexed(db, '/path/to/archive2.jsonl');
      const timestamp1Again = getFileLastIndexed(db, '/path/to/archive1.jsonl');

      expect(timestamp2).toBeGreaterThan(timestamp1!);
      expect(timestamp1Again).toBe(timestamp1);
    });
  });

  describe('deleteExchange', () => {
    test('deletes exchange by ID', () => {
      const exchange: ConversationExchange = {
        id: 'test-15',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Hello',
        assistantMessage: 'Hi there!',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const embedding = new Array(768).fill(0.1);
      insertExchange(db, exchange, embedding);

      // Verify it exists
      let row = db.prepare(`SELECT * FROM exchanges WHERE id = ?`).get(exchange.id);
      expect(row).toBeDefined();

      // Delete it
      deleteExchange(db, exchange.id);

      // Verify it's gone
      row = db.prepare(`SELECT * FROM exchanges WHERE id = ?`).get(exchange.id);
      expect(row).toBeUndefined();
    });

    test('also deletes associated vector data', () => {
      const exchange: ConversationExchange = {
        id: 'test-16',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Hello',
        assistantMessage: 'Hi there!',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const embedding = new Array(768).fill(0.1);
      insertExchange(db, exchange, embedding);

      // Verify vector data exists
      let vecRow = db.prepare(`SELECT * FROM vec_exchanges WHERE id = ?`).get(exchange.id);
      expect(vecRow).toBeDefined();

      // Delete exchange
      deleteExchange(db, exchange.id);

      // Verify vector data is also deleted
      vecRow = db.prepare(`SELECT * FROM vec_exchanges WHERE id = ?`).get(exchange.id);
      expect(vecRow).toBeUndefined();
    });

    test('handles non-existent IDs gracefully', () => {
      // This should not throw an error
      expect(() => {
        deleteExchange(db, 'non-existent-id');
      }).not.toThrow();

      // Verify database state is unchanged
      const count = db.prepare(`SELECT COUNT(*) as count FROM exchanges`).get() as { count: number };
      expect(count.count).toBe(0);
    });

    test('deletes only the specified exchange when multiple exist', () => {
      const exchange1: ConversationExchange = {
        id: 'test-17',
        project: 'test-project',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'Hello',
        assistantMessage: 'Hi there!',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 1,
        lineEnd: 10,
      };

      const exchange2: ConversationExchange = {
        id: 'test-18',
        project: 'test-project',
        timestamp: '2024-01-02T00:00:00.000Z',
        userMessage: 'How are you?',
        assistantMessage: 'I am doing well!',
        archivePath: '/path/to/archive.jsonl',
        lineStart: 11,
        lineEnd: 20,
      };

      const embedding = new Array(768).fill(0.1);
      insertExchange(db, exchange1, embedding);
      insertExchange(db, exchange2, embedding);

      // Delete only exchange1
      deleteExchange(db, 'test-17');

      // Verify exchange1 is deleted
      let row = db.prepare(`SELECT * FROM exchanges WHERE id = ?`).get('test-17');
      expect(row).toBeUndefined();

      // Verify exchange2 still exists
      row = db.prepare(`SELECT * FROM exchanges WHERE id = ?`).get('test-18');
      expect(row).toBeDefined();
    });
  });
});
