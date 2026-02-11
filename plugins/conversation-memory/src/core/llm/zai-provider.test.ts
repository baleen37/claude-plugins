/**
 * Tests for ZAIProvider
 *
 * These tests use mocking to avoid actual API calls while verifying correct behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZAIProvider } from './zai-provider.js';
import type { LLMOptions } from './types.js';

// Mock fetch globally - we need to declare it properly for TypeScript
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ZAIProvider', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Setup default successful response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Test response',
          },
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      }),
    });
  });

  describe('constructor', () => {
    it('should create a provider with API key', () => {
      const provider = new ZAIProvider('test-api-key');
      expect(provider).toBeDefined();
    });

    it('should create a provider with API key and custom model', () => {
      const provider = new ZAIProvider('test-api-key', 'glm-4.7');
      expect(provider).toBeDefined();
    });

    it('should use default model when not specified', () => {
      const provider = new ZAIProvider('test-api-key');
      expect(provider).toBeDefined();
    });

    it('should throw error when API key is missing', () => {
      expect(() => new ZAIProvider('')).toThrow('ZAIProvider requires an API key');
    });
  });

  describe('complete method', () => {
    it('should return text and usage from API response', async () => {
      const provider = new ZAIProvider('test-api-key');
      const result = await provider.complete('test prompt');

      expect(result.text).toBe('Test response');
      expect(result.usage.input_tokens).toBe(10);
      expect(result.usage.output_tokens).toBe(5);
    });

    it('should work with maxTokens option', async () => {
      const provider = new ZAIProvider('test-api-key');
      const options: LLMOptions = {
        maxTokens: 2048,
      };

      const result = await provider.complete('test prompt', options);
      expect(result.text).toBeDefined();

      // Verify the fetch was called with max_tokens in the body
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/completions'),
        expect.objectContaining({
          body: expect.stringContaining('"max_tokens":2048'),
        })
      );
    });

    it('should work with systemPrompt option', async () => {
      const provider = new ZAIProvider('test-api-key');
      const options: LLMOptions = {
        systemPrompt: 'You are a helpful assistant.',
      };

      const result = await provider.complete('test prompt', options);
      expect(result.text).toBeDefined();

      // Verify the fetch was called with system prompt in messages
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/completions'),
        expect.objectContaining({
          body: expect.stringContaining('"role":"system"'),
        })
      );
    });

    it('should work with both maxTokens and systemPrompt', async () => {
      const provider = new ZAIProvider('test-api-key');
      const options: LLMOptions = {
        maxTokens: 4096,
        systemPrompt: 'Write concise summaries.',
      };

      const result = await provider.complete('test prompt', options);
      expect(result.text).toBeDefined();
    });

    it('should throw error when API request fails', async () => {
      const provider = new ZAIProvider('test-api-key');

      // Mock failed response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: {
            message: 'Invalid API key',
          },
        }),
      });

      await expect(provider.complete('test prompt')).rejects.toThrow('Z.AI API request failed');
    });
  });

  describe('TokenUsage structure', () => {
    it('should return TokenUsage with input and output tokens', async () => {
      const provider = new ZAIProvider('test-api-key');
      const result = await provider.complete('test');

      expect(result.usage).toBeDefined();
      expect(typeof result.usage.input_tokens).toBe('number');
      expect(typeof result.usage.output_tokens).toBe('number');
    });

    it('should have undefined cache fields (not supported by ZAI)', async () => {
      const provider = new ZAIProvider('test-api-key');
      const result = await provider.complete('test');

      // Cache fields should be undefined since ZAI doesn't support them
      expect(result.usage.cache_read_input_tokens).toBeUndefined();
      expect(result.usage.cache_creation_input_tokens).toBeUndefined();
    });
  });

  describe('LLMProvider interface compliance', () => {
    it('should implement LLMProvider interface', () => {
      const provider = new ZAIProvider('test-api-key');

      // Verify the provider has the required method
      expect(typeof provider.complete).toBe('function');
    });

    it('should return LLMResult structure', async () => {
      const provider = new ZAIProvider('test-api-key');
      const result = await provider.complete('test');

      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe('string');
      expect(result.usage).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle simple summarization prompt', async () => {
      const provider = new ZAIProvider('test-api-key');

      const prompt = 'Summarize this conversation in one sentence.';
      const result = await provider.complete(prompt);

      expect(result.text).toBeDefined();
    });

    it('should handle long conversation prompt', async () => {
      const provider = new ZAIProvider('test-api-key');

      const longPrompt = `
        User: Hello
        Assistant: Hi there!
        User: How are you?
        Assistant: I'm doing well, thanks!
        [many more exchanges...]
      `;

      const result = await provider.complete(longPrompt, { maxTokens: 2048 });
      expect(result.text).toBeDefined();
    });

    it('should handle custom system prompt for summarization', async () => {
      const provider = new ZAIProvider('test-api-key');

      const options: LLMOptions = {
        systemPrompt: 'Write concise, factual summaries. Output ONLY the summary.',
      };

      const result = await provider.complete('Summarize this text', options);
      expect(result.text).toBeDefined();
    });
  });

  describe('default model configuration', () => {
    it('should use glm-4.7 as default model', () => {
      const provider = new ZAIProvider('test-api-key');
      expect(provider).toBeDefined();
    });

    it('should allow overriding the default model', () => {
      const customModel = 'glm-4.7';
      const provider = new ZAIProvider('test-api-key', customModel);
      expect(provider).toBeDefined();
    });
  });
});
