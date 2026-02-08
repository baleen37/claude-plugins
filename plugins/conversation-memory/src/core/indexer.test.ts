import { describe, test, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { recomputeToolSummaries } from './indexer.js';

// Helper function to create test database with tool_calls data
function initTestDatabase(): Database.Database {
  const db = new Database(':memory:');
  sqliteVec.load(db);

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
      thinking_triggers TEXT,
      compressed_tool_summary TEXT
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

  return db;
}

describe('File filtering for agent conversations', () => {
  test('filters out files starting with agent-', () => {
    const files = [
      'abc-123-def.jsonl',
      'agent-task-123.jsonl',
      'normal-conversation.jsonl',
      'agent-xyz.jsonl',
      'another-session.jsonl',
    ];

    const filtered = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));

    expect(filtered).toEqual([
      'abc-123-def.jsonl',
      'normal-conversation.jsonl',
      'another-session.jsonl',
    ]);
  });

  test('keeps files that have agent- in the middle but not at start', () => {
    const files = [
      'my-agent-conversation.jsonl',
      'reagent-analysis.jsonl',
      'agent-123.jsonl',
    ];

    const filtered = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));

    expect(filtered).toEqual([
      'my-agent-conversation.jsonl',
      'reagent-analysis.jsonl',
    ]);
  });

  test('filters out only .jsonl files', () => {
    const files = [
      'conversation.jsonl',
      'conversation.txt',
      'data.json',
      'agent-test.jsonl',
    ];

    const filtered = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));

    expect(filtered).toEqual([
      'conversation.jsonl',
    ]);
  });

  test('handles empty array', () => {
    const filtered = [].filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));
    expect(filtered).toEqual([]);
  });

  test('handles array with only agent files', () => {
    const files = [
      'agent-1.jsonl',
      'agent-2.jsonl',
      'agent-task.jsonl',
    ];

    const filtered = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));

    expect(filtered).toEqual([]);
  });
});

describe('recomputeToolSummaries', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initTestDatabase();
  });

  test('returns 0 when no tool calls exist', async () => {
    const count = await recomputeToolSummaries(db);
    expect(count).toBe(0);
  });

  test('recomputes summary for single tool call', async () => {
    // Insert an exchange
    db.prepare(`
      INSERT INTO exchanges (id, project, timestamp, user_message, assistant_message, archive_path, line_start, line_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('exchange-1', 'test-project', '2024-01-01T00:00:00.000Z', 'Hello', 'Hi', '/path/to/archive.jsonl', 1, 10);

    // Insert a tool call
    db.prepare(`
      INSERT INTO tool_calls (id, exchange_id, tool_name, tool_input, tool_result, is_error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('tool-1', 'exchange-1', 'Read', JSON.stringify({ file_path: '/path/to/file.ts' }), 'content', 0, '2024-01-01T00:00:01.000Z');

    const count = await recomputeToolSummaries(db);
    expect(count).toBe(1);

    // Verify the summary was updated
    const row = db.prepare(`SELECT compressed_tool_summary FROM exchanges WHERE id = ?`).get('exchange-1') as any;
    expect(row.compressed_tool_summary).toBe('Read: /path/to/file.ts');
  });

  test('recomputes summary for multiple tool calls on same exchange', async () => {
    // Insert an exchange
    db.prepare(`
      INSERT INTO exchanges (id, project, timestamp, user_message, assistant_message, archive_path, line_start, line_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('exchange-2', 'test-project', '2024-01-01T00:00:00.000Z', 'Hello', 'Hi', '/path/to/archive.jsonl', 1, 10);

    // Insert multiple tool calls
    db.prepare(`
      INSERT INTO tool_calls (id, exchange_id, tool_name, tool_input, tool_result, is_error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('tool-2a', 'exchange-2', 'Read', JSON.stringify({ file_path: '/path/to/file.ts' }), 'content', 0, '2024-01-01T00:00:01.000Z');

    db.prepare(`
      INSERT INTO tool_calls (id, exchange_id, tool_name, tool_input, tool_result, is_error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('tool-2b', 'exchange-2', 'Bash', JSON.stringify({ command: 'npm test' }), 'passed', 0, '2024-01-01T00:00:02.000Z');

    const count = await recomputeToolSummaries(db);
    expect(count).toBe(1);

    // Verify the summary was updated
    const row = db.prepare(`SELECT compressed_tool_summary FROM exchanges WHERE id = ?`).get('exchange-2') as any;
    expect(row.compressed_tool_summary).toContain('Read: /path/to/file.ts');
    expect(row.compressed_tool_summary).toContain('Bash:');
    expect(row.compressed_tool_summary).toContain('`npm test`');
  });

  test('recomputes summaries for multiple exchanges', async () => {
    // Insert two exchanges with tool calls
    db.prepare(`
      INSERT INTO exchanges (id, project, timestamp, user_message, assistant_message, archive_path, line_start, line_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('exchange-3', 'test-project', '2024-01-01T00:00:00.000Z', 'Hello', 'Hi', '/path/to/archive.jsonl', 1, 10);

    db.prepare(`
      INSERT INTO exchanges (id, project, timestamp, user_message, assistant_message, archive_path, line_start, line_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('exchange-4', 'test-project', '2024-01-01T00:00:00.000Z', 'Hello', 'Hi', '/path/to/archive.jsonl', 1, 10);

    // Insert tool calls for both exchanges
    db.prepare(`
      INSERT INTO tool_calls (id, exchange_id, tool_name, tool_input, tool_result, is_error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('tool-3', 'exchange-3', 'Read', JSON.stringify({ file_path: '/path/to/file.ts' }), 'content', 0, '2024-01-01T00:00:01.000Z');

    db.prepare(`
      INSERT INTO tool_calls (id, exchange_id, tool_name, tool_input, tool_result, is_error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('tool-4', 'exchange-4', 'Bash', JSON.stringify({ command: 'npm test' }), 'passed', 0, '2024-01-01T00:00:02.000Z');

    const count = await recomputeToolSummaries(db);
    expect(count).toBe(2);

    // Verify both summaries were updated
    const row3 = db.prepare(`SELECT compressed_tool_summary FROM exchanges WHERE id = ?`).get('exchange-3') as any;
    const row4 = db.prepare(`SELECT compressed_tool_summary FROM exchanges WHERE id = ?`).get('exchange-4') as any;

    expect(row3.compressed_tool_summary).toBe('Read: /path/to/file.ts');
    expect(row4.compressed_tool_summary).toContain('Bash:');
  });

  test('handles tool calls with null tool_input', async () => {
    // Insert an exchange
    db.prepare(`
      INSERT INTO exchanges (id, project, timestamp, user_message, assistant_message, archive_path, line_start, line_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('exchange-5', 'test-project', '2024-01-01T00:00:00.000Z', 'Hello', 'Hi', '/path/to/archive.jsonl', 1, 10);

    // Insert a tool call with null input
    db.prepare(`
      INSERT INTO tool_calls (id, exchange_id, tool_name, tool_input, tool_result, is_error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('tool-5', 'exchange-5', 'SomeTool', null, 'result', 0, '2024-01-01T00:00:01.000Z');

    const count = await recomputeToolSummaries(db);
    expect(count).toBe(1);

    // Verify the summary was updated (should show just tool name for null input)
    const row = db.prepare(`SELECT compressed_tool_summary FROM exchanges WHERE id = ?`).get('exchange-5') as any;
    expect(row.compressed_tool_summary).toBe('SomeTool');
  });

  test('handles malformed JSON in tool_input', async () => {
    // Insert an exchange
    db.prepare(`
      INSERT INTO exchanges (id, project, timestamp, user_message, assistant_message, archive_path, line_start, line_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('exchange-6', 'test-project', '2024-01-01T00:00:00.000Z', 'Hello', 'Hi', '/path/to/archive.jsonl', 1, 10);

    // Insert a tool call with invalid JSON
    db.prepare(`
      INSERT INTO tool_calls (id, exchange_id, tool_name, tool_input, tool_result, is_error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('tool-6', 'exchange-6', 'SomeTool', 'not-valid-json', 'result', 0, '2024-01-01T00:00:01.000Z');

    const count = await recomputeToolSummaries(db);
    expect(count).toBe(1);

    // Verify the summary was updated (should show just tool name when parsing fails)
    const row = db.prepare(`SELECT compressed_tool_summary FROM exchanges WHERE id = ?`).get('exchange-6') as any;
    expect(row.compressed_tool_summary).toBe('SomeTool');
  });

  test('only processes exchanges with tool calls', async () => {
    // Insert an exchange with tool calls
    db.prepare(`
      INSERT INTO exchanges (id, project, timestamp, user_message, assistant_message, archive_path, line_start, line_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('exchange-7', 'test-project', '2024-01-01T00:00:00.000Z', 'Hello', 'Hi', '/path/to/archive.jsonl', 1, 10);

    db.prepare(`
      INSERT INTO tool_calls (id, exchange_id, tool_name, tool_input, tool_result, is_error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('tool-7', 'exchange-7', 'Read', JSON.stringify({ file_path: '/path/to/file.ts' }), 'content', 0, '2024-01-01T00:00:01.000Z');

    // Insert an exchange without tool calls
    db.prepare(`
      INSERT INTO exchanges (id, project, timestamp, user_message, assistant_message, archive_path, line_start, line_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('exchange-8', 'test-project', '2024-01-01T00:00:00.000Z', 'Hello', 'Hi', '/path/to/archive.jsonl', 1, 10);

    const count = await recomputeToolSummaries(db);
    expect(count).toBe(1);

    // Verify only the exchange with tool calls was updated
    const row7 = db.prepare(`SELECT compressed_tool_summary FROM exchanges WHERE id = ?`).get('exchange-7') as any;
    const row8 = db.prepare(`SELECT compressed_tool_summary FROM exchanges WHERE id = ?`).get('exchange-8') as any;

    expect(row7.compressed_tool_summary).toBe('Read: /path/to/file.ts');
    expect(row8.compressed_tool_summary).toBeNull();
  });
});
