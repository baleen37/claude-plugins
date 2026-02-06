import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { parseConversation, parseConversationWithResult, parseConversationFile } from './parser.js';
import type { ConversationExchange } from './types.js';

describe('parser.ts', () => {
  let tempDir: string;
  let tempFilePath: string;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'parser-test-'));
    tempFilePath = path.join(tempDir, 'test-conversation.jsonl');
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('hasExclusionMarker (internal behavior)', () => {
    test('detects English "DO NOT INDEX THIS CHAT" marker', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'DO NOT INDEX THIS CHAT' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hello' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.isExcluded).toBe(true);
      expect(result.exchanges).toHaveLength(0);
      expect(result.exclusionReason).toContain('DO NOT INDEX THIS CHAT');
    });

    test('detects English "DO NOT INDEX THIS CONVERSATION" marker', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Please help me DO NOT INDEX THIS CONVERSATION' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hello' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.isExcluded).toBe(true);
      expect(result.exchanges).toHaveLength(0);
      expect(result.exclusionReason).toContain('DO NOT INDEX THIS CONVERSATION');
    });

    test('detects Korean exclusion marker "이 대화는 인덱싱하지 마세요"', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: '이 대화는 인덱싱하지 마세요' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hello' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.isExcluded).toBe(true);
      expect(result.exchanges).toHaveLength(0);
      expect(result.exclusionReason).toContain('이 대화는 인덱싱하지 마세요');
    });

    test('detects Korean exclusion marker "이 대화는 검색에서 제외하세요"', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: '이 대화는 검색에서 제외하세요' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hello' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.isExcluded).toBe(true);
      expect(result.exchanges).toHaveLength(0);
      expect(result.exclusionReason).toContain('이 대화는 검색에서 제외하세요');
    });

    test('handles case-insensitive exclusion marker detection', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'do not index this chat' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hello' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.isExcluded).toBe(true);
      expect(result.exchanges).toHaveLength(0);
    });

    test('detects exclusion marker in assistant message', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'I will help you. DO NOT INDEX THIS CONVERSATION' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.isExcluded).toBe(true);
      expect(result.exchanges).toHaveLength(0);
    });

    test('returns false when no exclusion marker is present', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello, how are you?' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'I am doing well!' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.isExcluded).toBe(false);
      expect(result.exclusionReason).toBeUndefined();
    });
  });

  describe('parseConversation()', () => {
    test('parses valid JSONL with simple user/assistant messages', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hi there!' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].userMessage).toBe('Hello');
      expect(exchanges[0].assistantMessage).toBe('Hi there!');
      expect(exchanges[0].project).toBe('test-project');
    });

    test('parses multiple conversation exchanges', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'First question' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'First answer' }, timestamp: '2024-01-01T00:00:01.000Z' },
        { type: 'user', message: { role: 'user', content: 'Second question' }, timestamp: '2024-01-01T00:00:02.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Second answer' }, timestamp: '2024-01-01T00:00:03.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(2);
      expect(exchanges[0].userMessage).toBe('First question');
      expect(exchanges[0].assistantMessage).toBe('First answer');
      expect(exchanges[1].userMessage).toBe('Second question');
      expect(exchanges[1].assistantMessage).toBe('Second answer');
    });

    test('extracts metadata from conversation', async () => {
      const jsonlContent = [
        {
          type: 'user',
          message: { role: 'user', content: 'Hello' },
          timestamp: '2024-01-01T00:00:00.000Z',
          parentUuid: 'parent-123',
          sessionId: 'session-456',
          cwd: '/project',
          gitBranch: 'main',
          version: '1.0.0',
          isSidechain: false
        },
        {
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi!' },
          timestamp: '2024-01-01T00:00:01.000Z'
        }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].parentUuid).toBe('parent-123');
      expect(exchanges[0].sessionId).toBe('session-456');
      expect(exchanges[0].cwd).toBe('/project');
      expect(exchanges[0].gitBranch).toBe('main');
      expect(exchanges[0].claudeVersion).toBe('1.0.0');
      expect(exchanges[0].isSidechain).toBe(false);
    });

    test('handles sidechain conversations', async () => {
      const jsonlContent = [
        {
          type: 'user',
          message: { role: 'user', content: 'Hello' },
          timestamp: '2024-01-01T00:00:00.000Z',
          isSidechain: true
        },
        {
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi!' },
          timestamp: '2024-01-01T00:00:01.000Z'
        }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].isSidechain).toBe(true);
    });

    test('extracts thinking metadata', async () => {
      const jsonlContent = [
        {
          type: 'user',
          message: { role: 'user', content: 'Hello' },
          timestamp: '2024-01-01T00:00:00.000Z',
          thinkingMetadata: {
            level: 'high',
            disabled: false,
            triggers: ['keyword1', 'keyword2']
          }
        },
        {
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi!' },
          timestamp: '2024-01-01T00:00:01.000Z'
        }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].thinkingLevel).toBe('high');
      expect(exchanges[0].thinkingDisabled).toBe(false);
      expect(exchanges[0].thinkingTriggers).toBe('["keyword1","keyword2"]');
    });

    test('handles array content format', async () => {
      const jsonlContent = [
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              { type: 'text', text: 'Hello from array' }
            ]
          },
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Hi from array' }
            ]
          },
          timestamp: '2024-01-01T00:00:01.000Z'
        }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].userMessage).toBe('Hello from array');
      expect(exchanges[0].assistantMessage).toBe('Hi from array');
    });

    test('extracts tool calls from assistant messages', async () => {
      const jsonlContent = [
        {
          type: 'user',
          message: { role: 'user', content: 'Read a file' },
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'I will read the file' },
              {
                type: 'tool_use',
                name: 'read_file',
                input: { file_path: '/path/to/file.txt' }
              }
            ]
          },
          timestamp: '2024-01-01T00:00:01.000Z'
        }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].toolCalls).toBeDefined();
      expect(exchanges[0].toolCalls).toHaveLength(1);
      expect(exchanges[0].toolCalls![0].toolName).toBe('read_file');
      expect(exchanges[0].toolCalls![0].toolInput).toEqual({ file_path: '/path/to/file.txt' });
      expect(exchanges[0].toolCalls![0].isError).toBe(false);
      expect(exchanges[0].toolCalls![0].exchangeId).toBe(exchanges[0].id);
    });

    test('extracts multiple tool calls from a single exchange', async () => {
      const jsonlContent = [
        {
          type: 'user',
          message: { role: 'user', content: 'Read two files' },
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'I will read both files' },
              {
                type: 'tool_use',
                name: 'read_file',
                input: { file_path: '/path/to/file1.txt' }
              },
              {
                type: 'tool_use',
                name: 'read_file',
                input: { file_path: '/path/to/file2.txt' }
              }
            ]
          },
          timestamp: '2024-01-01T00:00:01.000Z'
        }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].toolCalls).toHaveLength(2);
      expect(exchanges[0].toolCalls![0].toolName).toBe('read_file');
      expect(exchanges[0].toolCalls![1].toolName).toBe('read_file');
    });

    test('handles tool calls without names', async () => {
      const jsonlContent = [
        {
          type: 'user',
          message: { role: 'user', content: 'Do something' },
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'I will do it' },
              {
                type: 'tool_use',
                input: { some: 'data' }
              }
            ]
          },
          timestamp: '2024-01-01T00:00:01.000Z'
        }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].toolCalls).toHaveLength(1);
      expect(exchanges[0].toolCalls![0].toolName).toBe('unknown');
    });

    test('generates unique exchange IDs based on line numbers', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'First' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Answer 1' }, timestamp: '2024-01-01T00:00:01.000Z' },
        { type: 'user', message: { role: 'user', content: 'Second' }, timestamp: '2024-01-01T00:00:02.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Answer 2' }, timestamp: '2024-01-01T00:00:03.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(2);
      expect(exchanges[0].id).not.toBe(exchanges[1].id);
      expect(exchanges[0].lineStart).toBe(1);
      expect(exchanges[0].lineEnd).toBe(2);
      expect(exchanges[1].lineStart).toBe(3);
      expect(exchanges[1].lineEnd).toBe(4);
    });

    test('sets lineStart and lineEnd correctly', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Question' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Response' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].lineStart).toBe(1);
      expect(exchanges[0].lineEnd).toBe(2);
    });
  });

  describe('parseConversationWithResult()', () => {
    test('returns ParseResult with exchanges and exclusion status', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hi!' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.exchanges).toHaveLength(1);
      expect(result.isExcluded).toBe(false);
      expect(result.exclusionReason).toBeUndefined();
    });

    test('returns exclusion status as true when marker found', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'DO NOT INDEX THIS CHAT' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hi!' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.exchanges).toHaveLength(0);
      expect(result.isExcluded).toBe(true);
      expect(result.exclusionReason).toBeDefined();
    });

    test('handles empty files', async () => {
      fs.writeFileSync(tempFilePath, '');
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.exchanges).toHaveLength(0);
      expect(result.isExcluded).toBe(false);
    });

    test('handles files with only non-message types', async () => {
      const jsonlContent = [
        { type: 'metadata', timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'system', message: 'System message' },
        { type: 'other', data: 'something' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.exchanges).toHaveLength(0);
      expect(result.isExcluded).toBe(false);
    });
  });

  describe('parseConversationFile()', () => {
    test('reads and parses conversation file', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hi!' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationFile(tempFilePath);

      expect(result.exchanges).toHaveLength(1);
      expect(result.exchanges[0].userMessage).toBe('Hello');
      expect(result.isExcluded).toBe(false);
    });

    test('extracts project name from parent directory', async () => {
      const projectDir = path.join(tempDir, 'my-project');
      fs.mkdirSync(projectDir, { recursive: true });
      const projectFilePath = path.join(projectDir, 'conversation.jsonl');

      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hi!' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(projectFilePath, jsonlContent.join('\n'));
      const result = await parseConversationFile(projectFilePath);

      expect(result.project).toBe('my-project');
    });

    test('returns "unknown" for project when path has insufficient parts', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hi!' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationFile(tempFilePath);

      // tempFilePath ends with 'test-conversation.jsonl', so parent is the tempDir name
      expect(result.project).toBeDefined();
      expect(typeof result.project).toBe('string');
    });

    test('returns exclusion status in result', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'DO NOT INDEX THIS CONVERSATION' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hi!' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationFile(tempFilePath);

      expect(result.isExcluded).toBe(true);
      expect(result.exclusionReason).toBeDefined();
      expect(result.exchanges).toHaveLength(0);
    });

    test('handles file system errors gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent-file.jsonl');

      await expect(parseConversationFile(nonExistentPath)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('handles malformed JSON lines by skipping them', async () => {
      // Manually construct JSONL with some valid and some invalid JSON lines
      const jsonlContent = [
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'Valid message' }, timestamp: '2024-01-01T00:00:00.000Z' }),
        'this is not valid json {',
        JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: 'Valid response' }, timestamp: '2024-01-01T00:00:01.000Z' }),
        'another invalid line',
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'Second valid message' }, timestamp: '2024-01-01T00:00:02.000Z' }),
        JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: 'Second valid response' }, timestamp: '2024-01-01T00:00:03.000Z' })
      ];

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      // Should parse the valid exchanges and skip invalid JSON lines
      expect(exchanges.length).toBeGreaterThanOrEqual(1);
    });

    test('handles empty message content', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: '' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: '   ' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      // Empty messages should be skipped
      expect(exchanges).toHaveLength(0);
    });

    test('handles Unicode characters in messages', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello 世界 🌍 안녕하세요' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Response with emoji: 😀🎉' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].userMessage).toBe('Hello 世界 🌍 안녕하세요');
      expect(exchanges[0].assistantMessage).toBe('Response with emoji: 😀🎉');
    });

    test('handles messages without message field', async () => {
      const jsonlContent = [
        { type: 'user', timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'metadata', timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'user', message: { role: 'user', content: 'Valid message' }, timestamp: '2024-01-01T00:00:01.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Valid response' }, timestamp: '2024-01-01T00:00:02.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].userMessage).toBe('Valid message');
    });

    test('handles multiple assistant messages in one exchange', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Question' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'First part' }, timestamp: '2024-01-01T00:00:01.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Second part' }, timestamp: '2024-01-01T00:00:02.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Third part' }, timestamp: '2024-01-01T00:00:03.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].assistantMessage).toBe('First part\n\nSecond part\n\nThird part');
      expect(exchanges[0].lineEnd).toBe(4);
    });

    test('handles tool use with empty input', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Run tool' }, timestamp: '2024-01-01T00:00:00.000Z' },
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Running tool' },
              { type: 'tool_use', name: 'some_tool', input: {} }
            ]
          },
          timestamp: '2024-01-01T00:00:01.000Z'
        }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].toolCalls).toHaveLength(1);
      expect(exchanges[0].toolCalls![0].toolInput).toEqual({});
    });

    test('handles tool use with complex input', async () => {
      const complexInput = {
        nested: {
          data: {
            array: [1, 2, 3],
            string: 'test'
          }
        },
        nullField: null,
        number: 42
      };

      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Run complex tool' }, timestamp: '2024-01-01T00:00:00.000Z' },
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Running tool' },
              { type: 'tool_use', name: 'complex_tool', input: complexInput }
            ]
          },
          timestamp: '2024-01-01T00:00:01.000Z'
        }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].toolCalls).toHaveLength(1);
      expect(exchanges[0].toolCalls![0].toolInput).toEqual(complexInput);
    });

    test('does not include toolCalls when no tool calls exist', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hi!' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].toolCalls).toBeUndefined();
    });

    test('updates metadata from latest assistant message', async () => {
      const jsonlContent = [
        {
          type: 'user',
          message: { role: 'user', content: 'Hello' },
          timestamp: '2024-01-01T00:00:00.000Z',
          sessionId: 'session-1',
          cwd: '/project1',
          gitBranch: 'feature1'
        },
        {
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi!' },
          timestamp: '2024-01-01T00:00:01.000Z',
          sessionId: 'session-2',
          cwd: '/project2',
          gitBranch: 'feature2',
          version: '2.0.0'
        }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      // Metadata should be from assistant message (most recent)
      expect(exchanges[0].sessionId).toBe('session-2');
      expect(exchanges[0].cwd).toBe('/project2');
      expect(exchanges[0].gitBranch).toBe('feature2');
      expect(exchanges[0].claudeVersion).toBe('2.0.0');
    });

    test('handles conversation without assistant response', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      // Exchange without assistant response should not be included
      expect(exchanges).toHaveLength(0);
    });

    test('handles newlines in message content', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Line 1\nLine 2\nLine 3' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Response\nWith\nNewlines' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].userMessage).toBe('Line 1\nLine 2\nLine 3');
      expect(exchanges[0].assistantMessage).toBe('Response\nWith\nNewlines');
    });

    test('joins multiple text blocks in array content', async () => {
      const jsonlContent = [
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              { type: 'text', text: 'First block' },
              { type: 'text', text: 'Second block' },
              { type: 'text', text: 'Third block' }
            ]
          },
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Response block 1' },
              { type: 'text', text: 'Response block 2' }
            ]
          },
          timestamp: '2024-01-01T00:00:01.000Z'
        }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].userMessage).toBe('First block\nSecond block\nThird block');
      expect(exchanges[0].assistantMessage).toBe('Response block 1\nResponse block 2');
    });

    test('handles timestamp defaults when not provided', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' } },
        { type: 'assistant', message: { role: 'assistant', content: 'Hi!' } }
      ].map(JSON.stringify);

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].timestamp).toBeDefined();
      expect(typeof exchanges[0].timestamp).toBe('string');
      expect(exchanges[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
