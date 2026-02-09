/**
 * Tests for ZhipuAIProvider
 *
 * These tests use mocking to avoid actual API calls while verifying correct behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZhipuAIProvider } from './zhipu-provider.js';

// Mock the zhipuai-sdk-nodejs-v4 module before importing
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

vi.mock('zhipuai-sdk-nodejs-v4', () => ({
  ZhipuAI: mockZhipuAI,
}));

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
      expect(mockZhipuAI).toHaveBeenCalledWith({
        apiKey: 'valid-key',
        cacheToken: true
      });
    });

    it('should use default model when not specified', () => {
      const provider = new ZhipuAIProvider('valid-key');
      expect(provider).toBeDefined();
      expect(mockZhipuAI).toHaveBeenCalledWith({
        apiKey: 'valid-key',
        cacheToken: true
      });
    });
  });

  describe('complete method', () => {
    it('should call the API with prompt', async () => {
      const provider = new ZhipuAIProvider('test-api-key');
      const result = await provider.complete('test prompt');

      expect(result).toBeDefined();
      expect(mockCreateCompletions).toHaveBeenCalled();
    });

    it('should return text and usage from API response', async () => {
      const provider = new ZhipuAIProvider('test-api-key');
      const result = await provider.complete('test prompt');

      expect(result.text).toBe('Test response');
      expect(result.usage.input_tokens).toBe(10);
      expect(result.usage.output_tokens).toBe(5);
    });

    it('should call API with maxTokens when option is provided', async () => {
      const provider = new ZhipuAIProvider('test-api-key', 'glm-4.7');

      await provider.complete('test prompt', { maxTokens: 2048 });

      expect(mockCreateCompletions).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 2048,
        })
      );
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
