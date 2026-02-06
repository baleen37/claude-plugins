/**
 * Tests for LLM module barrel export (index.ts)
 *
 * These tests verify that all public types and functions are properly
 * re-exported from the LLM module's index.ts file.
 */

import { describe, it, expect } from 'bun:test';
import {
  // Classes from gemini-provider.ts
  GeminiProvider,
  // Classes from round-robin-provider.ts
  RoundRobinProvider,
  // Functions from config.ts
  loadConfig,
  createProvider,
} from './index.js';
import type {
  // Types from types.ts
  LLMProvider,
  LLMOptions,
  LLMResult,
  TokenUsage,
  // Types from config.ts
  LLMConfig,
} from './index.js';

describe('LLM Module Barrel Export', () => {
  describe('types exports', () => {
    it('should export LLMProvider type', () => {
      // Type-level test - if this compiles, the export works
      const provider: LLMProvider = {
        complete: async () => ({
          text: 'test',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      };
      expect(provider.complete).toBeDefined();
    });

    it('should export LLMOptions type', () => {
      const options: LLMOptions = { maxTokens: 100 };
      expect(options.maxTokens).toBe(100);
    });

    it('should export LLMResult type', () => {
      const result: LLMResult = {
        text: 'test',
        usage: { input_tokens: 1, output_tokens: 1 },
      };
      expect(result.text).toBe('test');
    });

    it('should export TokenUsage type', () => {
      const usage: TokenUsage = {
        input_tokens: 10,
        output_tokens: 5,
      };
      expect(usage.input_tokens).toBe(10);
    });
  });

  describe('GeminiProvider export', () => {
    it('should export GeminiProvider class', () => {
      expect(GeminiProvider).toBeDefined();
      expect(typeof GeminiProvider).toBe('function');
    });

    it('should create GeminiProvider instance', () => {
      const provider = new GeminiProvider('test-api-key');
      expect(provider).toBeInstanceOf(GeminiProvider);
      expect(provider.complete).toBeDefined();
    });
  });

  describe('RoundRobinProvider export', () => {
    it('should export RoundRobinProvider class', () => {
      expect(RoundRobinProvider).toBeDefined();
      expect(typeof RoundRobinProvider).toBe('function');
    });

    it('should create RoundRobinProvider instance', () => {
      const mockProvider: LLMProvider = {
        complete: async () => ({
          text: 'test',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      };
      const provider = new RoundRobinProvider([mockProvider]);
      expect(provider).toBeInstanceOf(RoundRobinProvider);
      expect(provider.complete).toBeDefined();
    });
  });

  describe('config exports', () => {
    it('should export LLMConfig type', () => {
      const config: LLMConfig = {
        provider: 'gemini',
        gemini: { apiKeys: ['key1'] },
      };
      expect(config.provider).toBe('gemini');
    });

    it('should export loadConfig function', () => {
      expect(loadConfig).toBeDefined();
      expect(typeof loadConfig).toBe('function');
    });

    it('should export createProvider function', () => {
      expect(createProvider).toBeDefined();
      expect(typeof createProvider).toBe('function');
    });
  });

  describe('import path consistency', () => {
    it('should allow clean imports from index', () => {
      // This test verifies that all runtime exports can be imported from a single path
      // Types are verified through TypeScript compilation (separate type-level tests above)
      const runtimeExports = {
        GeminiProvider,
        RoundRobinProvider,
        loadConfig,
        createProvider,
      };

      // Verify all runtime imports are present
      expect(Object.keys(runtimeExports)).toHaveLength(4);
      expect(runtimeExports.GeminiProvider).toBeDefined();
      expect(runtimeExports.RoundRobinProvider).toBeDefined();
      expect(runtimeExports.loadConfig).toBeDefined();
      expect(runtimeExports.createProvider).toBeDefined();
    });

    it('should compile with type exports', () => {
      // This test verifies type exports work through TypeScript compilation
      // If this compiles, all type exports are working correctly
      const options: LLMOptions = { maxTokens: 100 };
      const usage: TokenUsage = { input_tokens: 10, output_tokens: 5 };
      const result: LLMResult = { text: 'test', usage };
      const config: LLMConfig = { provider: 'gemini', gemini: { apiKeys: ['key1'] } };

      expect(options.maxTokens).toBe(100);
      expect(usage.input_tokens).toBe(10);
      expect(result.text).toBe('test');
      expect(config.provider).toBe('gemini');
    });
  });
});
