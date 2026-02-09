import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import {
  readConversation,
  formatConversationAsMarkdown
} from './read.js';

describe('read.ts', () => {
  let db: Database.Database;
  let dbPath: string;
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary database for testing
    dbPath = join(tmpdir(), `test-read-${Date.now()}.db`);
    db = new Database(dbPath);

    // Create temp directory for JSONL files
    tempDir = join(tmpdir(), `test-read-jsonl-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    // Create legacy exchanges table
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
        session_id TEXT,
        cwd TEXT,
        git_branch TEXT,
        claude_version TEXT,
        is_sidechain BOOLEAN DEFAULT 0,
        compressed_tool_summary TEXT
      )
    `);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const createMessage = (overrides: any = {}): string => {
    const defaults = {
      uuid: 'msg-123',
      parentUuid: null,
      timestamp: '2024-01-01T12:00:00.000Z',
      type: 'user',
      isSidechain: false,
      sessionId: 'session-456',
      gitBranch: 'main',
      cwd: '/project',
      version: '1.0.0',
      message: {
        role: 'user',
        content: 'Hello, world!'
      }
    };
    return JSON.stringify({ ...defaults, ...overrides });
  };

  describe('readConversation()', () => {
    test('returns null when path does not exist and no DB entry', () => {
      const result = readConversation(db, '/nonexistent/path.jsonl');
      expect(result).toBeNull();
    });

    test('reads from database when exchanges table has entry for path', () => {
      const timestamp = '2024-01-15T10:00:00.000Z';

      db.prepare(`
        INSERT INTO exchanges (
          id, project, timestamp, user_message, assistant_message,
          archive_path, line_start, line_end, session_id, cwd, git_branch, claude_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'exc-1', 'test-project', timestamp, 'Hello from DB!', 'Hi from DB!',
        '/test/path.jsonl', 1, 2, 'session-123', '/project', 'main', '1.0.0'
      );

      const result = readConversation(db, '/test/path.jsonl');

      expect(result).not.toBeNull();
      expect(result).toContain('# Conversation');
      expect(result).toContain('Hello from DB!');
      expect(result).toContain('Hi from DB!');
      expect(result).toContain('**Session ID:** session-123');
    });

    test('falls back to JSONL file when DB has no entry', () => {
      const jsonlPath = join(tempDir, 'test-conversation.jsonl');
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello from JSONL!' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi from JSONL!' }
        })
      ].join('\n');

      writeFileSync(jsonlPath, jsonl);

      const result = readConversation(db, jsonlPath);

      expect(result).not.toBeNull();
      expect(result).toContain('# Conversation');
      expect(result).toContain('Hello from JSONL!');
      expect(result).toContain('Hi from JSONL!');
      expect(result).toContain('**Session ID:** session-456');
    });

    test('returns null when JSONL file does not exist', () => {
      const result = readConversation(db, '/nonexistent/file.jsonl');
      expect(result).toBeNull();
    });

    test('respects startLine parameter when reading from DB', () => {
      const timestamp = '2024-01-15T10:00:00.000Z';

      db.prepare(`
        INSERT INTO exchanges (
          id, project, timestamp, user_message, assistant_message,
          archive_path, line_start, line_end, session_id, cwd, git_branch, claude_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'exc-1', 'test-project', timestamp, 'Message 1', 'Response 1',
        '/test/path.jsonl', 1, 2, 'session-123', '/project', 'main', '1.0.0'
      );

      db.prepare(`
        INSERT INTO exchanges (
          id, project, timestamp, user_message, assistant_message,
          archive_path, line_start, line_end, session_id, cwd, git_branch, claude_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'exc-2', 'test-project', timestamp, 'Message 2', 'Response 2',
        '/test/path.jsonl', 3, 4, 'session-123', '/project', 'main', '1.0.0'
      );

      const result = readConversation(db, '/test/path.jsonl', 3);

      expect(result).not.toContain('Message 1');
      expect(result).toContain('Message 2');
      expect(result).toContain('Response 2');
    });

    test('respects endLine parameter when reading from DB', () => {
      const timestamp = '2024-01-15T10:00:00.000Z';

      db.prepare(`
        INSERT INTO exchanges (
          id, project, timestamp, user_message, assistant_message,
          archive_path, line_start, line_end, session_id, cwd, git_branch, claude_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'exc-1', 'test-project', timestamp, 'Message 1', 'Response 1',
        '/test/path.jsonl', 1, 2, 'session-123', '/project', 'main', '1.0.0'
      );

      db.prepare(`
        INSERT INTO exchanges (
          id, project, timestamp, user_message, assistant_message,
          archive_path, line_start, line_end, session_id, cwd, git_branch, claude_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'exc-2', 'test-project', timestamp, 'Message 2', 'Response 2',
        '/test/path.jsonl', 3, 4, 'session-123', '/project', 'main', '1.0.0'
      );

      const result = readConversation(db, '/test/path.jsonl', undefined, 2);

      expect(result).toContain('Message 1');
      expect(result).toContain('Response 1');
      expect(result).not.toContain('Message 2');
    });

    test('respects startLine and endLine when reading from DB', () => {
      const timestamp = '2024-01-15T10:00:00.000Z';

      db.prepare(`
        INSERT INTO exchanges (
          id, project, timestamp, user_message, assistant_message,
          archive_path, line_start, line_end, session_id, cwd, git_branch, claude_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'exc-1', 'test-project', timestamp, 'Message 1', 'Response 1',
        '/test/path.jsonl', 1, 2, 'session-123', '/project', 'main', '1.0.0'
      );

      db.prepare(`
        INSERT INTO exchanges (
          id, project, timestamp, user_message, assistant_message,
          archive_path, line_start, line_end, session_id, cwd, git_branch, claude_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'exc-2', 'test-project', timestamp, 'Message 2', 'Response 2',
        '/test/path.jsonl', 3, 4, 'session-123', '/project', 'main', '1.0.0'
      );

      db.prepare(`
        INSERT INTO exchanges (
          id, project, timestamp, user_message, assistant_message,
          archive_path, line_start, line_end, session_id, cwd, git_branch, claude_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'exc-3', 'test-project', timestamp, 'Message 3', 'Response 3',
        '/test/path.jsonl', 5, 6, 'session-123', '/project', 'main', '1.0.0'
      );

      const result = readConversation(db, '/test/path.jsonl', 3, 4);

      expect(result).not.toContain('Message 1');
      expect(result).toContain('Message 2');
      expect(result).toContain('Response 2');
      expect(result).not.toContain('Message 3');
    });

    test('respects startLine parameter when reading from JSONL', () => {
      const jsonlPath = join(tempDir, 'test-pagination.jsonl');
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 1' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 1' }
        }),
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 2' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 2' }
        })
      ].join('\n');

      writeFileSync(jsonlPath, jsonl);

      const result = readConversation(db, jsonlPath, 3);

      expect(result).toContain('Message 2');
      expect(result).not.toContain('Message 1');
    });

    test('respects endLine parameter when reading from JSONL', () => {
      const jsonlPath = join(tempDir, 'test-pagination.jsonl');
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 1' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 1' }
        }),
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 2' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 2' }
        })
      ].join('\n');

      writeFileSync(jsonlPath, jsonl);

      const result = readConversation(db, jsonlPath, undefined, 2);

      expect(result).toContain('Message 1');
      expect(result).toContain('Response 1');
      expect(result).not.toContain('Message 2');
    });

    test('respects startLine and endLine when reading from JSONL', () => {
      const jsonlPath = join(tempDir, 'test-pagination.jsonl');
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 1' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 1' }
        }),
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 2' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 2' }
        }),
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 3' } })
      ].join('\n');

      writeFileSync(jsonlPath, jsonl);

      const result = readConversation(db, jsonlPath, 3, 4);

      expect(result).not.toContain('Message 1');
      expect(result).toContain('Message 2');
      expect(result).toContain('Response 2');
      expect(result).not.toContain('Message 3');
    });

    test('includes compressed tool summary when reading from DB', () => {
      const timestamp = '2024-01-15T10:00:00.000Z';

      db.prepare(`
        INSERT INTO exchanges (
          id, project, timestamp, user_message, assistant_message,
          archive_path, line_start, line_end, compressed_tool_summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'exc-1', 'test-project', timestamp, 'Read file', 'Here is the content',
        '/test/path.jsonl', 1, 2, 'Read: src/main.ts | Bash: `npm test`'
      );

      const result = readConversation(db, '/test/path.jsonl');

      expect(result).toContain('**Tools:** Read: src/main.ts | Bash: `npm test`');
    });

    test('formats tool use and results when reading from JSONL', () => {
      const jsonlPath = join(tempDir, 'test-tool.jsonl');
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Read file' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'I will read it' },
              {
                type: 'tool_use',
                id: 'tool-123',
                name: 'read_file',
                input: { file_path: '/path/to/file.txt' }
              }
            ]
          }
        })
      ].join('\n');

      writeFileSync(jsonlPath, jsonl);

      const result = readConversation(db, jsonlPath);

      expect(result).toContain('**Tool Use:** `read_file`');
      expect(result).toContain('**file_path:**');
      expect(result).toContain('/path/to/file.txt');
    });

    test('handles sidechain messages when reading from DB', () => {
      const timestamp = '2024-01-15T10:00:00.000Z';

      db.prepare(`
        INSERT INTO exchanges (
          id, project, timestamp, user_message, assistant_message,
          archive_path, line_start, line_end, session_id, cwd, git_branch, claude_version, is_sidechain
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'exc-1', 'test-project', timestamp, 'Sidechain user', 'Sidechain agent',
        '/test/path.jsonl', 1, 2, 'session-123', '/project', 'main', '1.0.0', 1
      );

      const result = readConversation(db, '/test/path.jsonl');

      expect(result).toContain('🔀 SIDECHAIN START');
      expect(result).toContain('🔀 SIDECHAIN END');
    });

    test('handles sidechain messages when reading from JSONL', () => {
      const jsonlPath = join(tempDir, 'test-sidechain.jsonl');
      const jsonl = [
        createMessage({
          type: 'user',
          isSidechain: true,
          message: { role: 'user', content: 'Sidechain user' }
        }),
        createMessage({
          type: 'assistant',
          isSidechain: true,
          message: { role: 'assistant', content: 'Sidechain agent' }
        })
      ].join('\n');

      writeFileSync(jsonlPath, jsonl);

      const result = readConversation(db, jsonlPath);

      expect(result).toContain('🔀 SIDECHAIN START');
      expect(result).toContain('🔀 SIDECHAIN END');
    });
  });

  describe('formatConversationAsMarkdown()', () => {
    test('formats simple user/assistant conversation', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi there!' }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('# Conversation');
      expect(result).toContain('## Metadata');
      expect(result).toContain('**Session ID:** session-456');
      expect(result).toContain('**Git Branch:** main');
      expect(result).toContain('**Working Directory:** /project');
      expect(result).toContain('**Claude Code Version:** 1.0.0');
      expect(result).toContain('## Messages');
      expect(result).toContain('### **User**');
      expect(result).toContain('Hello');
      expect(result).toContain('### **Agent**');
      expect(result).toContain('Hi there!');
    });

    test('handles line range with 1-indexed line numbers', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 1' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 1' }
        }),
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 2' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 2' }
        })
      ].join('\n');

      // startLine=3 should return from line 3 onwards (1-indexed)
      const result = formatConversationAsMarkdown(jsonl, 3);

      expect(result).toContain('Message 2');
      expect(result).not.toContain('Message 1');
    });

    test('handles empty input', () => {
      const result = formatConversationAsMarkdown('');
      expect(result).toBe('');
    });

    test('filters out system messages', () => {
      const jsonl = [
        createMessage({ type: 'system', message: { role: 'system', content: 'System msg' } }),
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi!' }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).not.toContain('System msg');
      expect(result).toContain('Hello');
    });

    test('groups sidechain content with markers', () => {
      const jsonl = [
        createMessage({
          type: 'user',
          message: { role: 'user', content: 'Main message' }
        }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Main response' }
        }),
        createMessage({
          type: 'user',
          isSidechain: true,
          message: { role: 'user', content: 'Sidechain user' }
        }),
        createMessage({
          type: 'assistant',
          isSidechain: true,
          message: { role: 'assistant', content: 'Sidechain agent' }
        }),
        createMessage({
          type: 'user',
          message: { role: 'user', content: 'Back to main' }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('🔀 SIDECHAIN START');
      expect(result).toContain('🔀 SIDECHAIN END');
      expect(result).toContain('Sidechain user');
      expect(result).toContain('Sidechain agent');
    });
  });
});
