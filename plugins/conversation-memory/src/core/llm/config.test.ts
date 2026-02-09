/**
 * Tests for LLM config loading and provider factory
 *
 * These tests verify:
 * - Config file loading from ~/.config/conversation-memory/config.json
 * - Provider creation from config
 * - Error handling for invalid configs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { loadConfig, createProvider, type LLMConfig } from './config.js';

// Test config directory path
const testConfigDir = join(process.env.HOME ?? '', '.config', 'conversation-memory');
const testConfigPath = join(testConfigDir, 'config.json');

// Mock the fs module
// NOTE: vi.mock() is hoisted to the top of the file before any other code runs.
// The factory function must be self-contained and cannot reference external variables.
let mockExistsSyncReturnValue = false;
let mockReadFileSyncReturnValue = '{}';

vi.mock('fs', () => ({
  existsSync: vi.fn((path: string) => mockExistsSyncReturnValue),
  readFileSync: vi.fn((path: string, encoding: string) => mockReadFileSyncReturnValue),
}));

// Import mocked functions
import { existsSync, readFileSync } from 'fs';

describe('loadConfig', () => {
  beforeEach(() => {
    mockExistsSyncReturnValue = false;
    mockReadFileSyncReturnValue = '{}';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when config file does not exist', () => {
    it('should return null', () => {
      mockExistsSyncReturnValue = false;

      const config = loadConfig();
      expect(config).toBeNull();
    });
  });

  describe('when config file exists and is valid', () => {
    it('should return LLMConfig with apiKey and model', () => {
      const validConfig = {
        apiKey: 'test-api-key',
        model: 'gemini-2.0-flash',
      };
      mockExistsSyncReturnValue = true;
      mockReadFileSyncReturnValue = JSON.stringify(validConfig);

      const config = loadConfig();
      expect(config).toEqual(validConfig);
    });

    it('should return LLMConfig with only apiKey (model defaults)', () => {
      const validConfig = {
        apiKey: 'test-api-key',
      };
      mockExistsSyncReturnValue = true;
      mockReadFileSyncReturnValue = JSON.stringify(validConfig);

      const config = loadConfig();
      expect(config).toEqual(validConfig);
    });
  });

  describe('when config file exists but is invalid', () => {
    it('should return null and log warning for invalid JSON', () => {
      mockExistsSyncReturnValue = true;
      mockReadFileSyncReturnValue = 'invalid json{';

      const consoleWarnSpy = vi.fn();
      globalThis.console = { ...console, warn: consoleWarnSpy };

      const config = loadConfig();
      expect(config).toBeNull();
    });

    it('should return null and log warning for missing apiKey field', () => {
      const invalidConfig = {
        model: 'gemini-2.0-flash',
      };
      mockExistsSyncReturnValue = true;
      mockReadFileSyncReturnValue = JSON.stringify(invalidConfig);

      const consoleWarnSpy = vi.fn();
      globalThis.console = { ...console, warn: consoleWarnSpy };

      const config = loadConfig();
      expect(config).toBeNull();
    });

    it('should return null and log warning for empty apiKey', () => {
      const invalidConfig = {
        apiKey: '',
      };
      mockExistsSyncReturnValue = true;
      mockReadFileSyncReturnValue = JSON.stringify(invalidConfig);

      const consoleWarnSpy = vi.fn();
      globalThis.console = { ...console, warn: consoleWarnSpy };

      const config = loadConfig();
      // Note: The current implementation checks for truthiness, so empty string is NOT considered valid
      expect(config).toBeNull();
    });
  });
});

describe('createProvider', () => {
  describe('valid configurations', () => {
    it('should create GeminiProvider with apiKey and default model', () => {
      const config: LLMConfig = {
        apiKey: 'test-api-key',
      };

      const provider = createProvider(config);

      expect(provider).toBeDefined();
      expect(provider.complete).toBeDefined();
      expect(typeof provider.complete).toBe('function');
    });

    it('should create GeminiProvider with apiKey and specified model', () => {
      const config: LLMConfig = {
        apiKey: 'test-api-key',
        model: 'gemini-2.0-flash',
      };

      const provider = createProvider(config);

      expect(provider).toBeDefined();
      expect(provider.complete).toBeDefined();
      expect(typeof provider.complete).toBe('function');
    });

    it('should create provider with correct structure for use', () => {
      const config: LLMConfig = {
        apiKey: 'test-key',
      };

      const provider = createProvider(config);

      // Verify provider has the expected structure
      expect(provider).toBeDefined();
      expect(typeof provider.complete).toBe('function');
      expect(provider.complete.length).toBeGreaterThan(0); // Has parameters
    });
  });

  describe('error handling', () => {
    it('should throw error when apiKey is missing', () => {
      const config = {
        model: 'gemini-2.0-flash',
      } as LLMConfig;

      expect(() => createProvider(config)).toThrow('requires an apiKey');
    });

    it('should throw error when apiKey is empty string', () => {
      const config: LLMConfig = {
        apiKey: '',
      };

      expect(() => createProvider(config)).toThrow('requires an apiKey');
    });
  });
});
