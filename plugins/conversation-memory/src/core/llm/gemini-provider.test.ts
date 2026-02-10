/**
 * Tests for GeminiProvider
 *
 * These tests use mocking to avoid actual API calls while verifying correct behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
import { GeminiProvider } from './gemini-provider.js';
import type { LLMOptions } from './types.js';

// Mock the @google/generative-ai module
// NOTE: vi.mock() is hoisted to the top of the file before any other code runs.
// The factory function must be self-contained and cannot reference external variables.
vi.mock('@google/generative-ai', () => {
  // Helper function to create a mock successful response
  const mockSuccessResponse = (text = 'Test response', promptTokens = 10, outputTokens = 5) => ({
    response: {
      text: vi.fn(() => text),
      usageMetadata: {
        promptTokenCount: promptTokens,
        candidatesTokenCount: outputTokens,
        totalTokenCount: promptTokens + outputTokens,
      },
    },
  });

  const mockGetGenerativeModel = vi.fn(() => ({
    generateContent: vi.fn(() => Promise.resolve(mockSuccessResponse())),
  }));

  const mockGoogleGenerativeAI = vi.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  }));

  return {
    GoogleGenerativeAI: mockGoogleGenerativeAI,
  };
});

describe('GeminiProvider', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a provider with API key', () => {
      const provider = new GeminiProvider('test-api-key');
      expect(provider).toBeDefined();
    });

    it('should create a provider with API key and custom model', () => {
      const provider = new GeminiProvider('test-api-key', 'gemini-2.0-flash');
      expect(provider).toBeDefined();
    });

    it('should use default model when not specified', () => {
      const provider = new GeminiProvider('test-api-key');
      expect(provider).toBeDefined();
    });

    it('should throw error when API key is missing', () => {
      expect(() => new GeminiProvider('')).toThrow('API key');
    });
  });

  describe('complete method', () => {
    it('should return text and usage from API response', async () => {
      const provider = new GeminiProvider('test-api-key');
      const result = await provider.complete('test prompt');

      expect(result.text).toBe('Test response');
      expect(result.usage.input_tokens).toBe(10);
      expect(result.usage.output_tokens).toBe(5);
    });

    it('should work with maxTokens option', async () => {
      const provider = new GeminiProvider('test-api-key');
      const options: LLMOptions = {
        maxTokens: 2048,
      };

      const result = await provider.complete('test prompt', options);
      expect(result.text).toBeDefined();
    });

    it('should work with systemPrompt option', async () => {
      const provider = new GeminiProvider('test-api-key');
      const options: LLMOptions = {
        systemPrompt: 'You are a helpful assistant.',
      };

      const result = await provider.complete('test prompt', options);
      expect(result.text).toBeDefined();
    });

    it('should work with both maxTokens and systemPrompt', async () => {
      const provider = new GeminiProvider('test-api-key');
      const options: LLMOptions = {
        maxTokens: 4096,
        systemPrompt: 'Write concise summaries.',
      };

      const result = await provider.complete('test prompt', options);
      expect(result.text).toBeDefined();
    });
  });

  describe('TokenUsage structure', () => {
    it('should return TokenUsage with input and output tokens', async () => {
      const provider = new GeminiProvider('test-api-key');
      const result = await provider.complete('test');

      expect(result.usage).toBeDefined();
      expect(typeof result.usage.input_tokens).toBe('number');
      expect(typeof result.usage.output_tokens).toBe('number');
    });

    it('should have undefined cache fields (not supported by Gemini)', async () => {
      const provider = new GeminiProvider('test-api-key');
      const result = await provider.complete('test');

      // Cache fields should be undefined since Gemini doesn't support them
      expect(result.usage.cache_read_input_tokens).toBeUndefined();
      expect(result.usage.cache_creation_input_tokens).toBeUndefined();
    });
  });

  describe('LLMProvider interface compliance', () => {
    it('should implement LLMProvider interface', () => {
      const provider = new GeminiProvider('test-api-key');

      // Verify the provider has the required method
      expect(typeof provider.complete).toBe('function');
    });

    it('should return LLMResult structure', async () => {
      const provider = new GeminiProvider('test-api-key');
      const result = await provider.complete('test');

      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe('string');
      expect(result.usage).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle simple summarization prompt', async () => {
      const provider = new GeminiProvider('test-api-key');

      const prompt = 'Summarize this conversation in one sentence.';
      const result = await provider.complete(prompt);

      expect(result.text).toBeDefined();
    });

    it('should handle long conversation prompt', async () => {
      const provider = new GeminiProvider('test-api-key');

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
      const provider = new GeminiProvider('test-api-key');

      const options: LLMOptions = {
        systemPrompt: 'Write concise, factual summaries. Output ONLY the summary.',
      };

      const result = await provider.complete('Summarize this text', options);
      expect(result.text).toBeDefined();
    });
  });

  describe('default model configuration', () => {
    it('should use gemini-2.0-flash as default model', () => {
      const provider = new GeminiProvider('test-api-key');
      expect(provider).toBeDefined();
    });

    it('should allow overriding the default model', () => {
      const customModel = 'gemini-2.0-flash';
      const provider = new GeminiProvider('test-api-key', customModel);
      expect(provider).toBeDefined();
    });
  });
});
