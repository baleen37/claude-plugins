import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseConversation } from './parser.js';

describe('parser.ts - Edge Cases and Error Handling', () => {
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

  describe('parseConversation() edge cases', () => {
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
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      // Empty messages should be skipped
      expect(exchanges).toHaveLength(0);
    });

    test('handles Unicode characters in messages', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello 世界 🌍 안녕하세요' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Response with emoji: 😀🎉' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].assistantMessage).toBe('First part\n\nSecond part\n\nThird part');
      expect(exchanges[0].lineEnd).toBe(4);
    });

    test('handles conversation without assistant response', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00.000Z' }
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      // Exchange without assistant response should not be included
      expect(exchanges).toHaveLength(0);
    });

    test('handles newlines in message content', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Line 1\nLine 2\nLine 3' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Response\nWith\nNewlines' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].userMessage).toBe('Line 1\nLine 2\nLine 3');
      expect(exchanges[0].assistantMessage).toBe('Response\nWith\nNewlines');
    });
  });

  describe('parseConversation() array content format', () => {
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
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].userMessage).toBe('Hello from array');
      expect(exchanges[0].assistantMessage).toBe('Hi from array');
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
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].userMessage).toBe('First block\nSecond block\nThird block');
      expect(exchanges[0].assistantMessage).toBe('Response block 1\nResponse block 2');
    });
  });
});
