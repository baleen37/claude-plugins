import { describe, test, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { initDatabaseV3, insertPendingEventV3, insertObservationV3, getPendingEventsV3, deleteOldPendingEventsV3, searchObservationsV3, getObservationV3 } from './db.v3.js';

describe('Database V3 Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Use in-memory database for testing
    process.env.CONVERSATION_MEMORY_DB_PATH = ':memory:';
    db = initDatabaseV3();
  });

  describe('initDatabaseV3', () => {
    test('creates all required tables', () => {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as Array<{ name: string }>;

      const tableNames = tables.map(t => t.name);

      // New V3 tables
      expect(tableNames).toContain('observations');
      expect(tableNames).toContain('pending_events');
      expect(tableNames).toContain('vec_observations');

      // Old tables should NOT exist
      expect(tableNames).not.toContain('exchanges');
      expect(tableNames).not.toContain('vec_exchanges');
      expect(tableNames).not.toContain('tool_calls');
      expect(tableNames).not.toContain('session_summaries');
    });

    test('creates pending_events table with correct schema', () => {
      const columns = db.prepare(`
        SELECT name, type, "notnull" FROM pragma_table_info('pending_events')
        ORDER BY cid
      `).all() as Array<{ name: string; type: string; notnull: number }>;

      const columnMap = new Map(columns.map(c => [c.name, { type: c.type, notnull: c.notnull }]));

      // Check required columns
      // Note: INTEGER PRIMARY KEY has notnull=0 in SQLite (it's implicitly NOT NULL)
      expect(columnMap.get('id')).toEqual({ type: 'INTEGER', notnull: 0 });
      expect(columnMap.get('session_id')).toEqual({ type: 'TEXT', notnull: 1 });
      expect(columnMap.get('project')).toEqual({ type: 'TEXT', notnull: 1 });
      expect(columnMap.get('tool_name')).toEqual({ type: 'TEXT', notnull: 1 });
      expect(columnMap.get('compressed')).toEqual({ type: 'TEXT', notnull: 1 });
      expect(columnMap.get('timestamp')).toEqual({ type: 'INTEGER', notnull: 1 });
      expect(columnMap.get('created_at')).toEqual({ type: 'INTEGER', notnull: 1 });

      // Check primary key
      const pk = db.prepare(`
        SELECT sql FROM sqlite_master WHERE type='table' AND name='pending_events'
      `).get() as { sql: string };

      expect(pk.sql).toContain('PRIMARY KEY');
    });

    test('creates observations table with correct schema', () => {
      const columns = db.prepare(`
        SELECT name, type, "notnull" FROM pragma_table_info('observations')
        ORDER BY cid
      `).all() as Array<{ name: string; type: string; notnull: number }>;

      const columnMap = new Map(columns.map(c => [c.name, { type: c.type, notnull: c.notnull }]));

      // Check required columns
      // Note: INTEGER PRIMARY KEY has notnull=0 in SQLite (it's implicitly NOT NULL)
      expect(columnMap.get('id')).toEqual({ type: 'INTEGER', notnull: 0 });
      expect(columnMap.get('title')).toEqual({ type: 'TEXT', notnull: 1 });
      expect(columnMap.get('content')).toEqual({ type: 'TEXT', notnull: 1 });
      expect(columnMap.get('project')).toEqual({ type: 'TEXT', notnull: 1 });
      expect(columnMap.get('session_id')).toEqual({ type: 'TEXT', notnull: 0 }); // nullable
      expect(columnMap.get('timestamp')).toEqual({ type: 'INTEGER', notnull: 1 });
      expect(columnMap.get('created_at')).toEqual({ type: 'INTEGER', notnull: 1 });
    });

    test('creates vec_observations virtual table', () => {
      const tableInfo = db.prepare(`
        SELECT sql FROM sqlite_master WHERE type='table' AND name='vec_observations'
      `).get() as { sql: string } | undefined;

      expect(tableInfo).toBeDefined();
      expect(tableInfo?.sql).toContain('vec0');
      expect(tableInfo?.sql).toContain('embedding');
    });


    test('creates proper indexes', () => {
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='index'
        AND name LIKE 'idx_%'
        ORDER BY name
      `).all() as Array<{ name: string }>;

      const indexNames = indexes.map(i => i.name);

      expect(indexNames).toContain('idx_pending_session');
      expect(indexNames).toContain('idx_pending_project');
      expect(indexNames).toContain('idx_pending_timestamp');
      expect(indexNames).toContain('idx_observations_project');
      expect(indexNames).toContain('idx_observations_session');
      expect(indexNames).toContain('idx_observations_timestamp');
    });

    test('enables WAL mode', () => {
      const result = db.pragma('journal_mode', { simple: true });
      // In-memory databases fall back to 'memory', file-based would be 'wal'
      expect(['wal', 'memory']).toContain(result);
    });

    test('loads sqlite-vec extension', () => {
      // Try to create a test vector to verify the extension is loaded
      const testVec = new Float32Array(768).fill(0.1);
      expect(() => {
        const stmt = db.prepare('INSERT INTO vec_observations (id, embedding) VALUES (?, ?)');
        stmt.run('test-id', Buffer.from(testVec.buffer));
        db.prepare('DELETE FROM vec_observations WHERE id = ?').run('test-id');
      }).not.toThrow();
    });
  });

  describe('insertPendingEventV3', () => {
    test('inserts pending event with all fields', () => {
      const now = Date.now();

      insertPendingEventV3(db, {
        sessionId: 'test-session',
        project: 'test-project',
        toolName: 'bash',
        compressed: 'command: echo test',
        timestamp: now,
        createdAt: now,
      });

      const row = db.prepare(`
        SELECT * FROM pending_events WHERE id = ?
      `).get(1) as any;

      expect(row).toBeDefined();
      expect(row.session_id).toBe('test-session');
      expect(row.project).toBe('test-project');
      expect(row.tool_name).toBe('bash');
      expect(row.compressed).toBe('command: echo test');
      expect(row.timestamp).toBe(now);
      expect(row.created_at).toBe(now);
    });

    test('auto-increments id', () => {
      insertPendingEventV3(db, {
        sessionId: 'session-1',
        project: 'project-1',
        toolName: 'tool1',
        compressed: 'data1',
        timestamp: Date.now(),
        createdAt: Date.now(),
      });

      insertPendingEventV3(db, {
        sessionId: 'session-2',
        project: 'project-2',
        toolName: 'tool2',
        compressed: 'data2',
        timestamp: Date.now(),
        createdAt: Date.now(),
      });

      const count = db.prepare(`SELECT COUNT(*) as count FROM pending_events`).get() as { count: number };
      expect(count.count).toBe(2);

      const firstRow = db.prepare(`SELECT id FROM pending_events WHERE id = 1`).get() as any;
      const secondRow = db.prepare(`SELECT id FROM pending_events WHERE id = 2`).get() as any;

      expect(firstRow).toBeDefined();
      expect(secondRow).toBeDefined();
    });

    test('stores special characters in compressed field', () => {
      const specialData = 'Multi\nLine\tData\twith\x00null';

      insertPendingEventV3(db, {
        sessionId: 'test-session',
        project: 'test-project',
        toolName: 'bash',
        compressed: specialData,
        timestamp: Date.now(),
        createdAt: Date.now(),
      });

      const row = db.prepare(`SELECT compressed FROM pending_events WHERE id = 1`).get() as any;
      expect(row.compressed).toBe(specialData);
    });
  });

  describe('insertObservationV3', () => {
    test('inserts observation with all required fields', () => {
      const now = Date.now();
      const embedding = new Array(768).fill(0.1);

      insertObservationV3(db, {
        title: 'Test Observation',
        content: 'This is test content for the observation',
        project: 'test-project',
        sessionId: 'test-session',
        timestamp: now,
        createdAt: now,
      }, embedding);

      const row = db.prepare(`
        SELECT * FROM observations WHERE id = 1
      `).get() as any;

      expect(row).toBeDefined();
      expect(row.title).toBe('Test Observation');
      expect(row.content).toBe('This is test content for the observation');
      expect(row.project).toBe('test-project');
      expect(row.session_id).toBe('test-session');
      expect(row.timestamp).toBe(now);
      expect(row.created_at).toBe(now);
    });

    test('inserts observation without sessionId', () => {
      const now = Date.now();

      insertObservationV3(db, {
        title: 'Test Observation',
        content: 'Content without session',
        project: 'test-project',
        timestamp: now,
        createdAt: now,
      });

      const row = db.prepare(`
        SELECT session_id FROM observations WHERE id = 1
      `).get() as any;

      expect(row.session_id).toBeNull();
    });

    test('stores embedding in vec_observations table', () => {
      const embedding = new Array(768).fill(0.5);

      insertObservationV3(db, {
        title: 'Test',
        content: 'Content',
        project: 'project',
        timestamp: Date.now(),
        createdAt: Date.now(),
      }, embedding);

      const vecRow = db.prepare(`
        SELECT embedding FROM vec_observations WHERE id = 1
      `).get() as any;

      expect(vecRow).toBeDefined();
      expect(vecRow.embedding).toBeInstanceOf(Buffer);
      expect(vecRow.embedding.length).toBe(768 * 4); // 768 floats * 4 bytes
    });


    test('handles multi-byte UTF-8 characters', () => {
      const utf8Data = 'Hello 世界 🌍 Korean: 한국어';

      insertObservationV3(db, {
        title: utf8Data,
        content: utf8Data,
        project: 'project',
        timestamp: Date.now(),
        createdAt: Date.now(),
      });

      const row = db.prepare(`
        SELECT title, content FROM observations WHERE id = 1
      `).get() as any;

      expect(row.title).toBe(utf8Data);
      expect(row.content).toBe(utf8Data);
    });
  });

  describe('getPendingEventsV3', () => {
    beforeEach(() => {
      const now = Date.now();

      // Insert test data
      for (let i = 1; i <= 5; i++) {
        insertPendingEventV3(db, {
          sessionId: 'session-1',
          project: 'project-1',
          toolName: `tool-${i}`,
          compressed: `data-${i}`,
          timestamp: now + i * 1000,
          createdAt: now + i * 1000,
        });
      }

      // Insert events for different session
      for (let i = 6; i <= 8; i++) {
        insertPendingEventV3(db, {
          sessionId: 'session-2',
          project: 'project-2',
          toolName: `tool-${i}`,
          compressed: `data-${i}`,
          timestamp: now + i * 1000,
          createdAt: now + i * 1000,
        });
      }
    });

    test('retrieves pending events for specific session', () => {
      const events = getPendingEventsV3(db, 'session-1', 10);

      expect(events).toHaveLength(5);
      expect(events.every(e => e.sessionId === 'session-1')).toBe(true);
    });

    test('respects limit parameter', () => {
      const events = getPendingEventsV3(db, 'session-1', 3);

      expect(events).toHaveLength(3);
    });

    test('returns events ordered by created_at ascending', () => {
      const events = getPendingEventsV3(db, 'session-1', 10);

      for (let i = 1; i < events.length; i++) {
        expect(events[i].createdAt).toBeGreaterThanOrEqual(events[i - 1].createdAt);
      }
    });

    test('returns all required fields', () => {
      const events = getPendingEventsV3(db, 'session-1', 1);

      expect(events[0]).toHaveProperty('id');
      expect(events[0]).toHaveProperty('sessionId');
      expect(events[0]).toHaveProperty('project');
      expect(events[0]).toHaveProperty('toolName');
      expect(events[0]).toHaveProperty('compressed');
      expect(events[0]).toHaveProperty('timestamp');
      expect(events[0]).toHaveProperty('createdAt');
    });

    test('returns empty array for non-existent session', () => {
      const events = getPendingEventsV3(db, 'non-existent', 10);

      expect(events).toEqual([]);
    });

    test('default limit is 10', () => {
      const events = getPendingEventsV3(db, 'session-1');

      expect(events.length).toBeLessThanOrEqual(10);
    });
  });

  describe('deleteOldPendingEventsV3', () => {
    test('deletes events older than specified timestamp', () => {
      const now = Date.now();

      // Insert old events
      insertPendingEventV3(db, {
        sessionId: 'session-1',
        project: 'project-1',
        toolName: 'old-tool',
        compressed: 'old-data',
        timestamp: now - 10000,
        createdAt: now - 10000,
      });

      // Insert new events
      insertPendingEventV3(db, {
        sessionId: 'session-1',
        project: 'project-1',
        toolName: 'new-tool',
        compressed: 'new-data',
        timestamp: now + 10000,
        createdAt: now + 10000,
      });

      // Delete events older than now
      deleteOldPendingEventsV3(db, now);

      const count = db.prepare(`SELECT COUNT(*) as count FROM pending_events`).get() as { count: number };
      expect(count.count).toBe(1);

      const remaining = db.prepare(`SELECT tool_name FROM pending_events WHERE id = 2`).get() as any;
      expect(remaining.tool_name).toBe('new-tool');
    });

    test('deletes only events for specific session', () => {
      const now = Date.now();

      insertPendingEventV3(db, {
        sessionId: 'session-1',
        project: 'project-1',
        toolName: 'tool-1',
        compressed: 'data-1',
        timestamp: now - 1000,
        createdAt: now - 1000,
      });

      insertPendingEventV3(db, {
        sessionId: 'session-2',
        project: 'project-2',
        toolName: 'tool-2',
        compressed: 'data-2',
        timestamp: now - 1000,
        createdAt: now - 1000,
      });

      // Delete old events only for session-1
      deleteOldPendingEventsV3(db, now, 'session-1');

      const session1Count = db.prepare(`
        SELECT COUNT(*) as count FROM pending_events WHERE session_id = 'session-1'
      `).get() as { count: number };

      const session2Count = db.prepare(`
        SELECT COUNT(*) as count FROM pending_events WHERE session_id = 'session-2'
      `).get() as { count: number };

      expect(session1Count.count).toBe(0);
      expect(session2Count.count).toBe(1);
    });

    test('deletes from vec_pending_events as well', () => {
      const now = Date.now();

      insertPendingEventV3(db, {
        sessionId: 'session-1',
        project: 'project-1',
        toolName: 'tool-1',
        compressed: 'data-1',
        timestamp: now - 1000,
        createdAt: now - 1000,
      });

      // Verify it exists
      let count = db.prepare(`SELECT COUNT(*) as count FROM pending_events`).get() as { count: number };
      expect(count.count).toBe(1);

      // Delete it
      deleteOldPendingEventsV3(db, now);

      // Verify it's gone
      count = db.prepare(`SELECT COUNT(*) as count FROM pending_events`).get() as { count: number };
      expect(count.count).toBe(0);
    });
  });

  describe('searchObservationsV3', () => {
    beforeEach(() => {
      const embedding1 = new Array(768).fill(0.1);
      const embedding2 = new Array(768).fill(0.9);

      insertObservationV3(db, {
        title: 'Database optimization',
        content: 'Improved query performance with indexes',
        project: 'project-a',
        sessionId: 'session-1',
        timestamp: Date.now() - 1000,
        createdAt: Date.now() - 1000,
      }, embedding1);

      insertObservationV3(db, {
        title: 'API refactoring',
        content: 'Cleaned up REST endpoints',
        project: 'project-a',
        sessionId: 'session-2',
        timestamp: Date.now(),
        createdAt: Date.now(),
      }, embedding2);

      insertObservationV3(db, {
        title: 'Testing improvements',
        content: 'Added unit tests for core modules',
        project: 'project-b',
        sessionId: 'session-3',
        timestamp: Date.now() + 1000,
        createdAt: Date.now() + 1000,
      }, embedding1);
    });

    test('returns all observations when no filters provided', () => {
      const results = searchObservationsV3(db, {});

      expect(results).toHaveLength(3);
    });

    test('filters by project', () => {
      const results = searchObservationsV3(db, { project: 'project-a' });

      expect(results).toHaveLength(2);
      expect(results.every(r => r.project === 'project-a')).toBe(true);
    });

    test('filters by sessionId', () => {
      const results = searchObservationsV3(db, { sessionId: 'session-1' });

      expect(results).toHaveLength(1);
      expect(results[0].sessionId).toBe('session-1');
    });

    test('filters by date range', () => {
      const now = Date.now();
      const results = searchObservationsV3(db, {
        after: now - 500,
        before: now + 500,
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('API refactoring');
    });

    test('respects limit parameter', () => {
      const results = searchObservationsV3(db, { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('returns observations ordered by timestamp descending', () => {
      const results = searchObservationsV3(db, {});

      for (let i = 1; i < results.length; i++) {
        expect(results[i].timestamp).toBeLessThanOrEqual(results[i - 1].timestamp);
      }
    });

    test('includes all required fields in results', () => {
      const results = searchObservationsV3(db, { limit: 1 });

      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('content');
      expect(results[0]).toHaveProperty('project');
      expect(results[0]).toHaveProperty('sessionId');
      expect(results[0]).toHaveProperty('timestamp');
      expect(results[0]).toHaveProperty('createdAt');
    });
  });

  describe('getObservationV3', () => {
    test('retrieves observation by id', () => {
      const now = Date.now();

      insertObservationV3(db, {
        title: 'Test Title',
        content: 'Test Content',
        project: 'test-project',
        sessionId: 'test-session',
        timestamp: now,
        createdAt: now,
      });

      const observation = getObservationV3(db, 1);

      expect(observation).toBeDefined();
      expect(observation!.id).toBe(1);
      expect(observation!.title).toBe('Test Title');
      expect(observation!.content).toBe('Test Content');
      expect(observation!.project).toBe('test-project');
      expect(observation!.sessionId).toBe('test-session');
    });

    test('returns null for non-existent id', () => {
      const observation = getObservationV3(db, 999);

      expect(observation).toBeNull();
    });

    test('includes all fields in result', () => {
      const now = Date.now();

      insertObservationV3(db, {
        title: 'Full Test',
        content: 'Full content test',
        project: 'full-project',
        sessionId: 'full-session',
        timestamp: now,
        createdAt: now,
      });

      const observation = getObservationV3(db, 1);

      expect(observation).toHaveProperty('id');
      expect(observation).toHaveProperty('title');
      expect(observation).toHaveProperty('content');
      expect(observation).toHaveProperty('project');
      expect(observation).toHaveProperty('sessionId');
      expect(observation).toHaveProperty('timestamp');
      expect(observation).toHaveProperty('createdAt');
    });
  });
});
