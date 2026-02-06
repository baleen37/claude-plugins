/**
 * Tests for RoundRobinProvider
 *
 * These tests verify the round-robin distribution behavior across multiple LLM providers.
 */

import { describe, it, expect, mock } from 'bun:test';
import { RoundRobinProvider } from './round-robin-provider.js';
import type { LLMProvider, LLMResult } from './types.js';

// Helper to create a mock provider
function createMockProvider(name: string): LLMProvider {
  return {
    complete: mock((prompt: string) =>
      Promise.resolve<LLMResult>({
        text: `Response from ${name}`,
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      })
    ),
  };
}

// Helper to create a mock provider that fails
function createFailingMockProvider(name: string): LLMProvider {
  return {
    complete: mock(() => Promise.reject(new Error(`Failed from ${name}`))),
  };
}

describe('RoundRobinProvider', () => {
  describe('constructor', () => {
    it('should create a provider with an array of providers', () => {
      const providers = [createMockProvider('A'), createMockProvider('B')];
      const provider = new RoundRobinProvider(providers);

      expect(provider).toBeDefined();
    });

    it('should create a provider with a single provider', () => {
      const providers = [createMockProvider('A')];
      const provider = new RoundRobinProvider(providers);

      expect(provider).toBeDefined();
    });

    it('should create a provider with empty array (throws on use)', () => {
      const provider = new RoundRobinProvider([]);

      expect(provider).toBeDefined();
    });
  });

  describe('complete method', () => {
    it('should distribute calls evenly across two providers', async () => {
      const providerA = createMockProvider('A');
      const providerB = createMockProvider('B');
      const roundRobin = new RoundRobinProvider([providerA, providerB]);

      await roundRobin.complete('test 1');
      await roundRobin.complete('test 2');
      await roundRobin.complete('test 3');
      await roundRobin.complete('test 4');

      expect(providerA.complete).toHaveBeenCalledTimes(2);
      expect(providerB.complete).toHaveBeenCalledTimes(2);
    });

    it('should distribute calls evenly across three providers', async () => {
      const providerA = createMockProvider('A');
      const providerB = createMockProvider('B');
      const providerC = createMockProvider('C');
      const roundRobin = new RoundRobinProvider([providerA, providerB, providerC]);

      await roundRobin.complete('test 1');
      await roundRobin.complete('test 2');
      await roundRobin.complete('test 3');
      await roundRobin.complete('test 4');
      await roundRobin.complete('test 5');
      await roundRobin.complete('test 6');

      expect(providerA.complete).toHaveBeenCalledTimes(2);
      expect(providerB.complete).toHaveBeenCalledTimes(2);
      expect(providerC.complete).toHaveBeenCalledTimes(2);
    });

    it('should cycle through providers in order', async () => {
      const providerA = createMockProvider('A');
      const providerB = createMockProvider('B');
      const providerC = createMockProvider('C');
      const roundRobin = new RoundRobinProvider([providerA, providerB, providerC]);

      const result1 = await roundRobin.complete('test 1');
      const result2 = await roundRobin.complete('test 2');
      const result3 = await roundRobin.complete('test 3');
      const result4 = await roundRobin.complete('test 4');

      expect(result1.text).toBe('Response from A');
      expect(result2.text).toBe('Response from B');
      expect(result3.text).toBe('Response from C');
      expect(result4.text).toBe('Response from A');
    });

    it('should use single provider repeatedly when only one provider exists', async () => {
      const providerA = createMockProvider('A');
      const roundRobin = new RoundRobinProvider([providerA]);

      await roundRobin.complete('test 1');
      await roundRobin.complete('test 2');
      await roundRobin.complete('test 3');

      expect(providerA.complete).toHaveBeenCalledTimes(3);
    });

    it('should pass prompt and options to the selected provider', async () => {
      const providerA = createMockProvider('A');
      const providerB = createMockProvider('B');
      const roundRobin = new RoundRobinProvider([providerA, providerB]);

      const options = { maxTokens: 2048, systemPrompt: 'Test system prompt' };
      await roundRobin.complete('test prompt', options);
      await roundRobin.complete('another prompt', options);

      expect(providerA.complete).toHaveBeenCalledWith('test prompt', options);
      expect(providerB.complete).toHaveBeenCalledWith('another prompt', options);
    });

    it('should return the result from the selected provider', async () => {
      const providerA = createMockProvider('A');
      const roundRobin = new RoundRobinProvider([providerA]);

      const result = await roundRobin.complete('test');

      expect(result.text).toBe('Response from A');
      expect(result.usage.input_tokens).toBe(10);
      expect(result.usage.output_tokens).toBe(5);
    });

    it('should throw error when providers array is empty', async () => {
      const roundRobin = new RoundRobinProvider([]);

      await expect(roundRobin.complete('test')).rejects.toThrow('No providers configured');
    });
  });

  describe('error handling', () => {
    it('should propagate errors from failing providers without retry', async () => {
      const providerA = createMockProvider('A');
      const providerB = createFailingMockProvider('B');
      const providerC = createMockProvider('C');
      const roundRobin = new RoundRobinProvider([providerA, providerB, providerC]);

      // First call goes to A (succeeds)
      await roundRobin.complete('test 1');

      // Second call goes to B (fails)
      await expect(roundRobin.complete('test 2')).rejects.toThrow('Failed from B');

      // Third call should go to C (succeeds)
      const result = await roundRobin.complete('test 3');
      expect(result.text).toBe('Response from C');
    });

    it('should not retry with next provider on failure', async () => {
      const providerA = createFailingMockProvider('A');
      const providerB = createMockProvider('B');
      const roundRobin = new RoundRobinProvider([providerA, providerB]);

      // Call to A should fail and NOT retry with B
      await expect(roundRobin.complete('test')).rejects.toThrow('Failed from A');

      // B should not have been called
      expect(providerB.complete).not.toHaveBeenCalled();

      // Next call should go to B
      const result = await roundRobin.complete('test 2');
      expect(result.text).toBe('Response from B');
    });
  });

  describe('LLMProvider interface compliance', () => {
    it('should implement LLMProvider interface', () => {
      const providers = [createMockProvider('A'), createMockProvider('B')];
      const provider = new RoundRobinProvider(providers);

      // Verify the provider has the required method
      expect(typeof provider.complete).toBe('function');
    });

    it('should return LLMResult structure', async () => {
      const providers = [createMockProvider('A')];
      const provider = new RoundRobinProvider(providers);
      const result = await provider.complete('test');

      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe('string');
      expect(result.usage).toBeDefined();
    });
  });

  describe('state management', () => {
    it('should maintain state across multiple calls', async () => {
      const providerA = createMockProvider('A');
      const providerB = createMockProvider('B');
      const roundRobin = new RoundRobinProvider([providerA, providerB]);

      // First round
      await roundRobin.complete('test 1');
      await roundRobin.complete('test 2');

      // Second round
      await roundRobin.complete('test 3');
      await roundRobin.complete('test 4');

      expect(providerA.complete).toHaveBeenCalledTimes(2);
      expect(providerB.complete).toHaveBeenCalledTimes(2);
    });

    it('should reset index correctly after cycling through all providers', async () => {
      const providerA = createMockProvider('A');
      const providerB = createMockProvider('B');
      const providerC = createMockProvider('C');
      const roundRobin = new RoundRobinProvider([providerA, providerB, providerC]);

      // Cycle through all providers
      const r1 = await roundRobin.complete('test 1');
      const r2 = await roundRobin.complete('test 2');
      const r3 = await roundRobin.complete('test 3');

      // Should start back at A
      const r4 = await roundRobin.complete('test 4');

      expect(r1.text).toBe('Response from A');
      expect(r2.text).toBe('Response from B');
      expect(r3.text).toBe('Response from C');
      expect(r4.text).toBe('Response from A');
    });
  });

  describe('rate limit distribution scenarios', () => {
    it('should distribute load evenly for high volume requests', async () => {
      const providers = Array.from({ length: 5 }, (_, i) =>
        createMockProvider(String.fromCharCode(65 + i))
      );
      const roundRobin = new RoundRobinProvider(providers);

      // Make 50 requests
      const promises = Array.from({ length: 50 }, (_, i) =>
        roundRobin.complete(`test ${i}`)
      );
      await Promise.all(promises);

      // Each provider should be called 10 times
      for (const provider of providers) {
        expect(provider.complete).toHaveBeenCalledTimes(10);
      }
    });

    it('should handle uneven number of requests across providers', async () => {
      const providerA = createMockProvider('A');
      const providerB = createMockProvider('B');
      const providerC = createMockProvider('C');
      const roundRobin = new RoundRobinProvider([providerA, providerB, providerC]);

      // Make 5 requests (not evenly divisible by 3)
      await roundRobin.complete('test 1');
      await roundRobin.complete('test 2');
      await roundRobin.complete('test 3');
      await roundRobin.complete('test 4');
      await roundRobin.complete('test 5');

      expect(providerA.complete).toHaveBeenCalledTimes(2); // calls 1, 4
      expect(providerB.complete).toHaveBeenCalledTimes(2); // calls 2, 5
      expect(providerC.complete).toHaveBeenCalledTimes(1); // call 3
    });
  });
});
