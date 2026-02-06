import { describe, it, expect } from 'vitest';
import {
  LLMProvider,
  LLMOptions,
  LLMResult,
  TokenUsage,
} from './types.js';

describe('LLM Types', () => {
  describe('TokenUsage', () => {
    it('should create a valid TokenUsage with required fields', () => {
      const usage: TokenUsage = {
        input_tokens: 100,
        output_tokens: 50,
      };

      expect(usage.input_tokens).toBe(100);
      expect(usage.output_tokens).toBe(50);
    });

    it('should create a valid TokenUsage with optional cache fields', () => {
      const usage: TokenUsage = {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 25,
        cache_creation_input_tokens: 10,
      };

      expect(usage.cache_read_input_tokens).toBe(25);
      expect(usage.cache_creation_input_tokens).toBe(10);
    });

    it('should allow undefined for optional cache fields', () => {
      const usage: TokenUsage = {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: undefined,
        cache_creation_input_tokens: undefined,
      };

      expect(usage.cache_read_input_tokens).toBeUndefined();
      expect(usage.cache_creation_input_tokens).toBeUndefined();
    });
  });

  describe('LLMOptions', () => {
    it('should create empty options', () => {
      const options: LLMOptions = {};

      expect(Object.keys(options)).toHaveLength(0);
    });

    it('should create options with maxTokens', () => {
      const options: LLMOptions = {
        maxTokens: 4096,
      };

      expect(options.maxTokens).toBe(4096);
    });

    it('should create options with systemPrompt', () => {
      const options: LLMOptions = {
        systemPrompt: 'You are a helpful assistant.',
      };

      expect(options.systemPrompt).toBe('You are a helpful assistant.');
    });

    it('should create options with both fields', () => {
      const options: LLMOptions = {
        maxTokens: 2048,
        systemPrompt: 'Summarize this text.',
      };

      expect(options.maxTokens).toBe(2048);
      expect(options.systemPrompt).toBe('Summarize this text.');
    });
  });

  describe('LLMResult', () => {
    it('should create a valid LLMResult', () => {
      const usage: TokenUsage = {
        input_tokens: 100,
        output_tokens: 50,
      };

      const result: LLMResult = {
        text: 'This is the response text.',
        usage,
      };

      expect(result.text).toBe('This is the response text.');
      expect(result.usage).toEqual(usage);
    });

    it('should create LLMResult with full token usage', () => {
      const usage: TokenUsage = {
        input_tokens: 200,
        output_tokens: 100,
        cache_read_input_tokens: 50,
        cache_creation_input_tokens: 20,
      };

      const result: LLMResult = {
        text: 'Response with caching.',
        usage,
      };

      expect(result.usage.input_tokens).toBe(200);
      expect(result.usage.output_tokens).toBe(100);
      expect(result.usage.cache_read_input_tokens).toBe(50);
      expect(result.usage.cache_creation_input_tokens).toBe(20);
    });
  });

  describe('LLMProvider interface contract', () => {
    it('should define a complete method signature', () => {
      // This test validates that the LLMProvider interface can be implemented
      // The actual implementation will be in provider classes

      type ProviderImplementation = Pick<LLMProvider, 'complete'>;

      const mockProvider: ProviderImplementation = {
        complete: async (prompt: string, options?: LLMOptions) => {
          return {
            text: `Response to: ${prompt}`,
            usage: {
              input_tokens: 10,
              output_tokens: 5,
            },
          };
        },
      };

      expect(mockProvider.complete).toBeInstanceOf(Function);
    });

    it('should allow calling complete with prompt only', async () => {
      const mockProvider: LLMProvider = {
        complete: async (prompt: string, _options?: LLMOptions) => {
          return {
            text: `Echo: ${prompt}`,
            usage: { input_tokens: 5, output_tokens: 2 },
          };
        },
      };

      const result = await mockProvider.complete('test prompt');

      expect(result.text).toBe('Echo: test prompt');
      expect(result.usage.input_tokens).toBe(5);
      expect(result.usage.output_tokens).toBe(2);
    });

    it('should allow calling complete with options', async () => {
      const mockProvider: LLMProvider = {
        complete: async (prompt: string, options?: LLMOptions) => {
          return {
            text: `Response with maxTokens: ${options?.maxTokens ?? 'default'}`,
            usage: { input_tokens: 5, output_tokens: 2 },
          };
        },
      };

      const result = await mockProvider.complete('test', { maxTokens: 1000 });

      expect(result.text).toBe('Response with maxTokens: 1000');
      expect(result.usage.input_tokens).toBe(5);
    });

    it('should allow calling complete with systemPrompt', async () => {
      let receivedSystemPrompt: string | undefined;

      const mockProvider: LLMProvider = {
        complete: async (_prompt: string, options?: LLMOptions) => {
          receivedSystemPrompt = options?.systemPrompt;
          return {
            text: 'Response',
            usage: { input_tokens: 5, output_tokens: 2 },
          };
        },
      };

      await mockProvider.complete('test', {
        systemPrompt: 'Custom system prompt',
      });

      expect(receivedSystemPrompt).toBe('Custom system prompt');
    });
  });

  describe('Type compatibility with existing TokenUsage', () => {
    it('should match summarizer TokenUsage structure', () => {
      // Verify compatibility with existing summarizer.ts TokenUsage
      const existingUsage: TokenUsage = {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 10,
        cache_creation_input_tokens: 5,
      };

      // This should work without any type issues
      const llmUsage: TokenUsage = existingUsage;

      expect(llmUsage).toEqual(existingUsage);
    });
  });
});
