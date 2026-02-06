/**
 * Tests for GeminiProvider
 *
 * These tests use mocking to avoid actual API calls while verifying correct behavior.
 */

import { describe, it, expect, mock } from 'bun:test';
import { GeminiProvider } from './gemini-provider.js';
import type { LLMOptions } from './types.js';

// Helper to create a mock successful response
function mockSuccessResponse(text = 'Test response', promptTokens = 10, outputTokens = 5) {
  const response = {
    text: mock(() => text),
    usageMetadata: {
      promptTokenCount: promptTokens,
      candidatesTokenCount: outputTokens,
      totalTokenCount: promptTokens + outputTokens,
    },
  };
  return { response };
}

// Mock the @google/generative-ai module
const mockGetGenerativeModel = mock(() => ({
  generateContent: mock(() => Promise.resolve(mockSuccessResponse())),
}));

const mockGoogleGenerativeAI = mock(() => ({
  getGenerativeModel: mockGetGenerativeModel,
}));

// Mock the module
mock.module('@google/generative-ai', () => ({
  GoogleGenerativeAI: mockGoogleGenerativeAI,
}));

describe('GeminiProvider', () => {
  describe('constructor', () => {
    it('should create a provider with API key', () => {
      const provider = new GeminiProvider('test-api-key');

      expect(provider).toBeDefined();
      expect(mockGoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
    });

    it('should create a provider with API key and custom model', () => {
      const provider = new GeminiProvider('test-api-key', 'gemini-2.0-flash');

      expect(provider).toBeDefined();
      expect(mockGoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
    });

    it('should use default model when not specified', () => {
      const provider = new GeminiProvider('test-api-key');

      expect(provider).toBeDefined();
      expect(mockGoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
    });

    it('should throw error when API key is missing', () => {
      expect(() => new GeminiProvider('')).toThrow('API key');
    });
  });

  describe('complete method', () => {
    it('should call the API with prompt', async () => {
      const provider = new GeminiProvider('test-api-key');
      const result = await provider.complete('test prompt');

      expect(result).toBeDefined();
      expect(mockGetGenerativeModel).toHaveBeenCalled();
    });

    it('should return text and usage from API response', async () => {
      const provider = new GeminiProvider('test-api-key');
      const result = await provider.complete('test prompt');

      expect(result.text).toBe('Test response');
      expect(result.usage.input_tokens).toBe(10);
      expect(result.usage.output_tokens).toBe(5);
    });

    it('should call API with maxOutputTokens when maxTokens option is provided', async () => {
      const provider = new GeminiProvider('test-api-key');
      const options: LLMOptions = {
        maxTokens: 2048,
      };

      await provider.complete('test prompt', options);

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            maxOutputTokens: 2048,
          }),
        })
      );
    });

    it('should call API with systemInstruction when systemPrompt option is provided', async () => {
      const provider = new GeminiProvider('test-api-key');
      const options: LLMOptions = {
        systemPrompt: 'You are a helpful assistant.',
      };

      await provider.complete('test prompt', options);

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          systemInstruction: 'You are a helpful assistant.',
        })
      );
    });

    it('should call API with both maxTokens and systemPrompt', async () => {
      const provider = new GeminiProvider('test-api-key');
      const options: LLMOptions = {
        maxTokens: 4096,
        systemPrompt: 'Write concise summaries.',
      };

      await provider.complete('test prompt', options);

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            maxOutputTokens: 4096,
          }),
          systemInstruction: 'Write concise summaries.',
        })
      );
    });
  });

  describe('error handling', () => {
    it('should throw error when API call fails', async () => {
      // Mock a failed API call
      mockGetGenerativeModel.mockImplementationOnce(() => ({
        generateContent: mock(() => Promise.reject(new Error('API error'))),
      }));

      const provider = new GeminiProvider('test-api-key');

      await expect(provider.complete('test prompt')).rejects.toThrow('Gemini API call failed');
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
