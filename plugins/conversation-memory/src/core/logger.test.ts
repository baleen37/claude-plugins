/**
 * Tests for logger.ts - Logging functionality for conversation-memory.
 *
 * This logger provides:
 * - logInfo() - logs info messages
 * - logWarn() - logs warning messages
 * - logError() - logs error messages (no stderr output)
 * - logDebug() - logs debug messages only when CONVERSATION_MEMORY_DEBUG=true
 * - formatLogEntry() - formats log entries
 * - writeLog() - writes to log file
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import { LogLevel, logInfo, logWarn, logError, logDebug } from './logger.js';

// Mock the paths module
vi.mock('./paths.js', () => ({
  getLogFilePath: vi.fn(() => '/tmp/test-conversation-memory.log'),
}));

// Mock fs.appendFileSync
const mockAppendFileSync = vi.spyOn(fs, 'appendFileSync').mockImplementation(() => {});

describe('logger', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Clear all mocks
    vi.clearAllMocks();

    // Mock console output
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Restore console
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('LogLevel enum', () => {
    test('should have correct log levels', () => {
      expect(LogLevel.INFO).toBe('INFO');
      expect(LogLevel.WARN).toBe('WARN');
      expect(LogLevel.ERROR).toBe('ERROR');
      expect(LogLevel.DEBUG).toBe('DEBUG');
    });
  });

  describe('logInfo', () => {
    test('should write to file and console', () => {
      const testMessage = 'Test info message';

      logInfo(testMessage);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/tmp/test-conversation-memory.log',
        expect.stringContaining('[INFO]'),
        'utf-8'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(testMessage)
      );
    });

    test('should include timestamp in log entry', () => {
      logInfo('test');

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      expect(logEntry).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });

    test('should include data when provided', () => {
      const testData = { key: 'value', count: 42 };

      logInfo('test with data', testData);

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      expect(logEntry).toContain(JSON.stringify(testData));
    });

    test('should not include data when not provided', () => {
      logInfo('test without data');

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      // Should not have JSON object after message
      expect(logEntry).toMatch(/\[INFO\] test without data\n$/);
    });
  });

  describe('logWarn', () => {
    test('should write to file and console with warning', () => {
      const testMessage = 'Test warning message';

      logWarn(testMessage);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/tmp/test-conversation-memory.log',
        expect.stringContaining('[WARN]'),
        'utf-8'
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(testMessage)
      );
    });

    test('should include timestamp in warning log entry', () => {
      logWarn('warning test');

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      expect(logEntry).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
      expect(logEntry).toContain('[WARN]');
    });

    test('should include data when provided', () => {
      const testData = { error: 'something went wrong', code: 500 };

      logWarn('warning with data', testData);

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      expect(logEntry).toContain(JSON.stringify(testData));
    });
  });

  describe('logError', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Mock console.error to ensure it's NOT called
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    test('should write to file but NOT to stderr', () => {
      const testMessage = 'Test error message';

      logError(testMessage);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/tmp/test-conversation-memory.log',
        expect.stringContaining('[ERROR]'),
        'utf-8'
      );
      // Critical: errors should NOT go to stderr to avoid leaking into LLM context
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('should include error stack trace when Error object provided', () => {
      const testError = new Error('Test error');
      testError.stack = 'Error: Test error\n    at test.js:10:15';

      logError('Something went wrong', testError);

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      expect(logEntry).toContain('Error: Test error');
      expect(logEntry).toContain('test.js:10:15');
    });

    test('should include error name and message', () => {
      const testError = new TypeError('Invalid type');

      logError('Type error occurred', testError);

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      expect(logEntry).toContain('TypeError');
      expect(logEntry).toContain('Invalid type');
    });

    test('should handle non-Error objects', () => {
      const nonError = { custom: 'error object', code: 123 };

      logError('Custom error', nonError);

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      expect(logEntry).toContain(JSON.stringify(nonError));
    });

    test('should include additional data when provided', () => {
      const testData = { userId: '123', action: 'delete' };
      const testError = new Error('Database error');

      logError('Operation failed', testError, testData);

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      expect(logEntry).toContain('"userId":"123"');
      expect(logEntry).toContain('"action":"delete"');
      expect(logEntry).toContain('Database error');
    });

    test('should handle error without data', () => {
      const testError = new Error('Simple error');

      logError('Error occurred', testError);

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      expect(logEntry).toContain('error');
    });
  });

  describe('logDebug', () => {
    test('should log when CONVERSATION_MEMORY_DEBUG is true', () => {
      process.env.CONVERSATION_MEMORY_DEBUG = 'true';

      logDebug('Debug message');

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/tmp/test-conversation-memory.log',
        expect.stringContaining('[DEBUG]'),
        'utf-8'
      );
      // Debug logs include the message
      const logCall = (consoleLogSpy as ReturnType<typeof vi.spyOn>).mock.calls.find((call) =>
        call[0] as string === '[DEBUG] Debug message'
      );
      expect(logCall).toBeTruthy();
    });

    test('should NOT log when CONVERSATION_MEMORY_DEBUG is not set', () => {
      delete process.env.CONVERSATION_MEMORY_DEBUG;

      logDebug('Debug message');

      expect(mockAppendFileSync).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('should NOT log when CONVERSATION_MEMORY_DEBUG is false', () => {
      process.env.CONVERSATION_MEMORY_DEBUG = 'false';

      logDebug('Debug message');

      expect(mockAppendFileSync).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('should include data when debug enabled', () => {
      process.env.CONVERSATION_MEMORY_DEBUG = 'true';

      const testData = { variable: 'value', state: 'active' };

      logDebug('Debug with data', testData);

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      expect(logEntry).toContain(JSON.stringify(testData));

      // Verify console.log was called with debug message and data
      const debugCalls = (consoleLogSpy as ReturnType<typeof vi.spyOn>).mock.calls.filter((call) =>
        (call[0] as string).includes('[DEBUG]')
      );
      expect(debugCalls.length).toBeGreaterThan(0);
    });
  });

  describe('log entry formatting', () => {
    test('should format log entry correctly with data', () => {
      logInfo('test message', { key: 'value' });

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      // Format: [timestamp] [level] message data\n
      expect(logEntry).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
      expect(logEntry).toContain('[INFO]');
      expect(logEntry).toContain('test message');
      expect(logEntry).toContain('{"key":"value"}');
      expect(logEntry.slice(-1)).toBe('\n');
    });

    test('should format log entry correctly without data', () => {
      logWarn('warning message');

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      // Format: [timestamp] [level] message\n
      expect(logEntry).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
      expect(logEntry).toContain('[WARN]');
      expect(logEntry).toContain('warning message');
      expect(logEntry).not.toContain('{');
      expect(logEntry.slice(-1)).toBe('\n');
    });

    test('should handle special characters in message', () => {
      const specialMessage = 'Message with "quotes" and \'apostrophes\'';

      logInfo(specialMessage);

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      expect(logEntry).toContain(specialMessage);
    });

    test('should handle unicode characters', () => {
      const unicodeMessage = 'Test with emoji 🚀 and unicode 中文';

      logInfo(unicodeMessage);

      const logCall = mockAppendFileSync.mock.calls[0];
      const logEntry = logCall[1] as string;

      expect(logEntry).toContain('🚀');
      expect(logEntry).toContain('中文');
    });
  });

  describe('file writing behavior', () => {
    test('should append to log file', () => {
      logInfo('First message');
      logInfo('Second message');

      expect(mockAppendFileSync).toHaveBeenCalledTimes(2);

      const firstCall = mockAppendFileSync.mock.calls[0];
      const secondCall = mockAppendFileSync.mock.calls[1];

      expect(firstCall[0]).toBe('/tmp/test-conversation-memory.log');
      expect(secondCall[0]).toBe('/tmp/test-conversation-memory.log');
    });

    test('should use utf-8 encoding', () => {
      logInfo('test');

      const logCall = mockAppendFileSync.mock.calls[0];

      expect(logCall[2]).toBe('utf-8');
    });
  });
});
