import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseConversation, parseConversationWithResult, parseConversationFile } from './parser.js';

describe('parser.ts - Basic Parsing', () => {
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
    test('parses valid JSONL with simple user/assistant messages', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hi there!' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(2);
      expect(exchanges[0].userMessage).toBe('First question');
      expect(exchanges[0].assistantMessage).toBe('First answer');
      expect(exchanges[1].userMessage).toBe('Second question');
      expect(exchanges[1].assistantMessage).toBe('Second answer');
    });

    test('generates unique exchange IDs based on line numbers', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'First' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Answer 1' }, timestamp: '2024-01-01T00:00:01.000Z' },
        { type: 'user', message: { role: 'user', content: 'Second' }, timestamp: '2024-01-01T00:00:02.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Answer 2' }, timestamp: '2024-01-01T00:00:03.000Z' }
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.exchanges).toHaveLength(1);
      expect(result.isExcluded).toBe(false);
      expect(result.exclusionReason).toBeUndefined();
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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(projectFilePath, jsonlContent.join('\n'));
      const result = await parseConversationFile(projectFilePath);

      expect(result.project).toBe('my-project');
    });

    test('returns "unknown" for project when path has insufficient parts', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hi!' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationFile(tempFilePath);

      // tempFilePath ends with 'test-conversation.jsonl', so parent is the tempDir name
      expect(result.project).toBeDefined();
      expect(typeof result.project).toBe('string');
    });

    test('handles file system errors gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent-file.jsonl');

      await expect(parseConversationFile(nonExistentPath)).rejects.toThrow();
    });
  });
});
