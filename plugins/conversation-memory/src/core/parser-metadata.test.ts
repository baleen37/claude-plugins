import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseConversation } from './parser.js';

describe('parser.ts - Metadata Extraction', () => {
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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

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
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].thinkingLevel).toBe('high');
      expect(exchanges[0].thinkingDisabled).toBe(false);
      expect(exchanges[0].thinkingTriggers).toBe('["keyword1","keyword2"]');
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
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      // Metadata should be from assistant message (most recent)
      expect(exchanges[0].sessionId).toBe('session-2');
      expect(exchanges[0].cwd).toBe('/project2');
      expect(exchanges[0].gitBranch).toBe('feature2');
      expect(exchanges[0].claudeVersion).toBe('2.0.0');
    });

    test('handles timestamp defaults when not provided', async () => {
      const jsonlContent = [
        { type: 'user', message: { role: 'user', content: 'Hello' } },
        { type: 'assistant', message: { role: 'assistant', content: 'Hi!' } }
      ].map((obj) => JSON.stringify(obj));

      fs.writeFileSync(tempFilePath, jsonlContent.join('\n'));
      const exchanges = await parseConversation(tempFilePath, 'test-project', tempFilePath);

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].timestamp).toBeDefined();
      expect(typeof exchanges[0].timestamp).toBe('string');
      expect(exchanges[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
