import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseConversationWithResult } from './parser.js';

describe('parser.ts - Exclusion Marker Detection', () => {
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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.isExcluded).toBe(true);
      expect(result.exchanges).toHaveLength(0);
    });

    test('detects exclusion marker in assistant message', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'I will help you. DO NOT INDEX THIS CONVERSATION' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.isExcluded).toBe(true);
      expect(result.exchanges).toHaveLength(0);
    });

    test('returns false when no exclusion marker is present', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello, how are you?' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'I am doing well!' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const result = await parseConversationWithResult(tempFilePath, 'test-project', tempFilePath);

      expect(result.isExcluded).toBe(false);
      expect(result.exclusionReason).toBeUndefined();
    });
  });

  describe('parseConversationFile() exclusion handling', () => {
    test('returns exclusion status in result', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'DO NOT INDEX THIS CONVERSATION' }, timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'assistant', message: { role: 'assistant', content: 'Hi!' }, timestamp: '2024-01-01T00:00:01.000Z' }
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const { parseConversationFile } = await import('./parser.js');
      const result = await parseConversationFile(tempFilePath);

      expect(result.isExcluded).toBe(true);
      expect(result.exclusionReason).toBeDefined();
      expect(result.exchanges).toHaveLength(0);
    });
  });
});
