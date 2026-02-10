/**
 * Tests for ZhipuAIProvider
 *
 * These tests use mocking to avoid actual API calls while verifying correct behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZhipuAIProvider } from './zhipu-provider.js';

// Mock the zhipuai-sdk-nodejs-v4 module
// NOTE: vi.mock() is hoisted to the top of the file before any other code runs.
// The factory function must be self-contained and cannot reference external variables.
vi.mock('zhipuai-sdk-nodejs-v4', () => {
  const mockCreateCompletions = vi.fn(() => Promise.resolve({
    choices: [{
      message: {
        content: 'Test response'
      }
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15
    }
  }));

  const mockZhipuAI = vi.fn(() => ({
    createCompletions: mockCreateCompletions,
  }));

  return {
    ZhipuAI: mockZhipuAI,
  };
});

describe('ZhipuAIProvider', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when apiKey is missing', () => {
      expect(() => new ZhipuAIProvider('')).toThrow('ZhipuAIProvider requires an API key');
    });

    it('should create instance with valid apiKey', () => {
      const provider = new ZhipuAIProvider('valid-key', 'glm-4.7');
      expect(provider).toBeDefined();
    });

    it('should use default model when not specified', () => {
      const provider = new ZhipuAIProvider('valid-key');
      expect(provider).toBeDefined();
    });
  });

  describe('complete method', () => {
    it('should call the API and return text and usage from API response', async () => {
      const provider = new ZhipuAIProvider('test-api-key');
      const result = await provider.complete('test prompt');

      expect(result.text).toBe('Test response');
      expect(result.usage.input_tokens).toBe(10);
      expect(result.usage.output_tokens).toBe(5);
    });
  });

  describe('LLMProvider interface compliance', () => {
    it('should implement LLMProvider interface', () => {
      const provider = new ZhipuAIProvider('test-api-key');

      expect(typeof provider.complete).toBe('function');
    });

    it('should return LLMResult structure', async () => {
      const provider = new ZhipuAIProvider('test-api-key');
      const result = await provider.complete('test');

      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe('string');
      expect(result.usage).toBeDefined();
    });
  });
});
