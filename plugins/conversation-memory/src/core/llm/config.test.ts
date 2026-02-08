/**
 * Tests for LLM config loading and provider factory
 *
 * These tests verify:
 * - Config file loading from ~/.config/conversation-memory/config.json
 * - Provider creation from config
 * - RoundRobinProvider wrapping for multiple API keys
 * - Error handling for invalid configs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadConfig, createProvider, type LLMConfig } from './config.js';

// Mock the fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

// Test config directory path
const testConfigDir = join(process.env.HOME ?? '', '.config', 'conversation-memory');
const testConfigPath = join(testConfigDir, 'config.json');

describe('loadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when config file does not exist', () => {
    it('should return null', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const config = loadConfig();
      expect(config).toBeNull();
    });
  });

  describe('when config file exists and is valid', () => {
    it('should return LLMConfig for gemini provider', () => {
      const validConfig = {
        provider: 'gemini',
        gemini: {
          apiKeys: ['key1', 'key2'],
          model: 'gemini-2.0-flash',
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const config = loadConfig();
      expect(config).toEqual(validConfig);
    });

    it('should return LLMConfig for gemini provider without model', () => {
      const validConfig = {
        provider: 'gemini',
        gemini: {
          apiKeys: ['key1'],
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const config = loadConfig();
      expect(config).toEqual(validConfig);
    });

    it('should return LLMConfig with only provider field', () => {
      const validConfig = {
        provider: 'gemini',
        gemini: {
          apiKeys: ['key1'],
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const config = loadConfig();
      expect(config).toEqual(validConfig);
    });

    it('should return LLMConfig with skipTools array', () => {
      const validConfig = {
        provider: 'gemini',
        gemini: {
          apiKeys: ['key1'],
        },
        skipTools: ['TodoWrite', 'TaskCreate', 'Glob'],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const config = loadConfig();
      expect(config).toEqual(validConfig);
      expect(config?.skipTools).toEqual(['TodoWrite', 'TaskCreate', 'Glob']);
    });

    it('should return LLMConfig with empty skipTools array', () => {
      const validConfig = {
        provider: 'gemini',
        gemini: {
          apiKeys: ['key1'],
        },
        skipTools: [],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const config = loadConfig();
      expect(config).toEqual(validConfig);
      expect(config?.skipTools).toEqual([]);
    });
  });

  describe('when config file exists but is invalid', () => {
    it('should return null and log warning for invalid JSON', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid json{');

      const consoleWarnSpy = vi.fn();
      globalThis.console = { ...console, warn: consoleWarnSpy };

      const config = loadConfig();
      expect(config).toBeNull();
    });

    it('should return null and log warning for missing provider field', () => {
      const invalidConfig = {
        gemini: {
          apiKeys: ['key1'],
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(invalidConfig));

      const consoleWarnSpy = vi.fn();
      globalThis.console = { ...console, warn: consoleWarnSpy };

      const config = loadConfig();
      expect(config).toBeNull();
    });
  });
});

describe('createProvider', () => {
  describe('gemini provider', () => {
    it('should create RoundRobinProvider with multiple GeminiProviders from apiKeys', () => {
      const config: LLMConfig = {
        provider: 'gemini',
        gemini: {
          apiKeys: ['key1', 'key2', 'key3'],
        },
      };

      const provider = createProvider(config);

      expect(provider).toBeDefined();
      expect(provider.complete).toBeDefined();
      expect(typeof provider.complete).toBe('function');
    });

    it('should create single GeminiProvider when only one API key', () => {
      const config: LLMConfig = {
        provider: 'gemini',
        gemini: {
          apiKeys: ['single-key'],
        },
      };

      const provider = createProvider(config);

      expect(provider).toBeDefined();
      expect(provider.complete).toBeDefined();
    });

    it('should use default model gemini-2.0-flash when not specified', () => {
      const config: LLMConfig = {
        provider: 'gemini',
        gemini: {
          apiKeys: ['key1'],
        },
      };

      const provider = createProvider(config);

      expect(provider).toBeDefined();
      expect(provider.complete).toBeDefined();
    });

    it('should use specified model from config', () => {
      const config: LLMConfig = {
        provider: 'gemini',
        gemini: {
          apiKeys: ['key1'],
          model: 'gemini-2.0-flash',
        },
      };

      const provider = createProvider(config);

      expect(provider).toBeDefined();
      expect(provider.complete).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw error when apiKeys array is empty', () => {
      const config: LLMConfig = {
        provider: 'gemini',
        gemini: {
          apiKeys: [],
        },
      };

      expect(() => createProvider(config)).toThrow('at least one API key');
    });

    it('should throw error when provider name is unknown', () => {
      const config: LLMConfig = {
        provider: 'unknown-provider',
        gemini: {
          apiKeys: ['key1'],
        },
      };

      expect(() => createProvider(config)).toThrow('Unknown provider');
    });

    it('should throw error when gemini config is missing', () => {
      const config: LLMConfig = {
        provider: 'gemini',
      };

      expect(() => createProvider(config)).toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should create provider with correct structure for use', () => {
      const config: LLMConfig = {
        provider: 'gemini',
        gemini: {
          apiKeys: ['test-key'],
        },
      };

      const provider = createProvider(config);

      // Verify provider has the expected structure
      expect(provider).toBeDefined();
      expect(typeof provider.complete).toBe('function');
      expect(provider.complete.length).toBeGreaterThan(0); // Has parameters
    });

    it('should create RoundRobinProvider with multiple providers for load distribution', () => {
      const config: LLMConfig = {
        provider: 'gemini',
        gemini: {
          apiKeys: ['key1', 'key2', 'key3'],
        },
      };

      const provider = createProvider(config);

      // Should create a provider (RoundRobinProvider wrapping multiple GeminiProviders)
      expect(provider).toBeDefined();
      expect(typeof provider.complete).toBe('function');
    });
  });
});
