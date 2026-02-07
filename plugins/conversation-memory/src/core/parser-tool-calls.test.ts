import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseConversation } from './parser.js';

describe('parser.ts - Tool Call Handling', () => {
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

  describe('parseConversation()', () => {
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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].toolCalls).toHaveLength(1);
      expect(exchanges[0].toolCalls![0].toolName).toBe('unknown');
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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].toolCalls).toBeUndefined();
    });

    test('creates exchange when assistant has only tool_use blocks without text', async () => {
      // This is the bug: parser requires assistantMessages.length > 0
      // but modern Claude Code conversations often have only tool_use blocks
      const jsonlContent = [
        {
          type: 'user',
          message: { role: 'user', content: 'Read the file' },
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                name: 'read_file',
                input: { file_path: '/path/to/file.txt' }
              }
            ]
          },
          timestamp: '2024-01-01T00:00:01.000Z'
        }
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      // Should create exchange even though assistant has no text content
      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].userMessage).toBe('Read the file');
      expect(exchanges[0].toolCalls).toBeDefined();
      expect(exchanges[0].toolCalls).toHaveLength(1);
      expect(exchanges[0].toolCalls![0].toolName).toBe('read_file');
      // assistantMessage should be empty or placeholder when no text exists
      expect(exchanges[0].assistantMessage).toBe('');
    });

    test('creates exchange when assistant has tool_use and user has tool_result only', async () => {
      // Another common pattern: user message is just tool results
      const jsonlContent = [
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: '123', content: 'File content here' }
            ]
          },
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                name: 'write_file',
                input: { file_path: '/output.txt', content: 'new content' }
              }
            ]
          },
          timestamp: '2024-01-01T00:00:01.000Z'
        }
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      // Should create exchange even with only tool interactions
      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].toolCalls).toBeDefined();
      expect(exchanges[0].toolCalls).toHaveLength(1);
      expect(exchanges[0].toolCalls![0].toolName).toBe('write_file');
    });
  });
});
