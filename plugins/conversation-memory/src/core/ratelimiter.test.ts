/**
 * Ratelimiter Tests
 *
 * Tests for the global rate limiter module using token bucket algorithm.
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter, createRateLimiter, getEmbeddingRateLimiter, getLLMRateLimiter, resetRateLimiters } from './ratelimiter.js';

// Mock the config module
let mockConfigReturnValue: { ratelimit?: { embedding?: { requestsPerSecond?: number; burstSize?: number }; llm?: { requestsPerSecond?: number; burstSize?: number } } } | null = null;

vi.mock('./llm/config.js', () => ({
  loadConfig: () => mockConfigReturnValue,
}));

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    // Set system time to 0 and use fake timers
    vi.useFakeTimers();
    vi.setSystemTime(0);
    limiter = new RateLimiter({ requestsPerSecond: 2, burstSize: 2 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Token Bucket Algorithm', () => {
    test('allows requests within burst size immediately', async () => {
      // Burst size is 2, so first 2 requests should be immediate
      const promise1 = limiter.acquire();
      const promise2 = limiter.acquire();

      await expect(promise1).resolves.toBeUndefined();
      await expect(promise2).resolves.toBeUndefined();
    });

    test('delays requests exceeding burst size', async () => {
      // First 2 should be immediate
      await limiter.acquire();
      await limiter.acquire();

      // Third should be delayed
      const promise3 = limiter.acquire();
      const spy = vi.fn();
      promise3.then(spy);

      // Should not be resolved yet
      expect(spy).not.toHaveBeenCalled();

      // Advance time by 500ms (1 token at 2/s)
      vi.advanceTimersByTime(500);

      // Flush pending timers/promises
      await vi.runAllTimersAsync();

      expect(spy).toHaveBeenCalled();
    });

    test('tokens refill over time', async () => {
      // Use all tokens
      await limiter.acquire();
      await limiter.acquire();

      // Wait for 1 second (should refill 2 tokens)
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Should have 2 tokens available again
      const promise1 = limiter.acquire();
      const promise2 = limiter.acquire();

      await expect(promise1).resolves.toBeUndefined();
      await expect(promise2).resolves.toBeUndefined();
    });

    test('tokens do not exceed burst size', async () => {
      // Use one token
      await limiter.acquire();

      // Wait for 10 seconds (would refill 20 tokens, but capped at burst size)
      vi.advanceTimersByTime(10000);
      await Promise.resolve();

      // Should only have 2 tokens (burst size)
      await limiter.acquire();
      await limiter.acquire();

      // Third should be delayed
      const promise3 = limiter.acquire();
      const spy = vi.fn();
      promise3.then(spy);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    test('uses default values when not specified', () => {
      const defaultLimiter = new RateLimiter();
      // Default: 5 requests per second, burst size of 10
      expect(defaultLimiter.getAvailableTokens()).toBe(10);
    });

    test('accepts custom configuration', () => {
      const customLimiter = new RateLimiter({ requestsPerSecond: 10, burstSize: 5 });
      expect(customLimiter.getAvailableTokens()).toBe(5);
    });

    test('burst size defaults to 2x requests per second', () => {
      const limiter = new RateLimiter({ requestsPerSecond: 3 });
      expect(limiter.getAvailableTokens()).toBe(6);
    });
  });

  describe('tryAcquire', () => {
    test('returns true when tokens available', () => {
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
    });

    test('returns false when no tokens available', () => {
      limiter.tryAcquire();
      limiter.tryAcquire();
      expect(limiter.tryAcquire()).toBe(false);
    });

    test('does not queue request on failure', () => {
      // tryAcquire should return false immediately without queuing
      limiter.tryAcquire();
      limiter.tryAcquire();
      expect(limiter.tryAcquire()).toBe(false); // No tokens available
      expect(limiter.tryAcquire()).toBe(false); // Still no tokens, not queued
    });
  });

  describe('getAvailableTokens', () => {
    test('returns current token count', async () => {
      expect(limiter.getAvailableTokens()).toBe(2);

      await limiter.acquire();
      expect(limiter.getAvailableTokens()).toBe(1);

      await limiter.acquire();
      expect(limiter.getAvailableTokens()).toBe(0);
    });

    test('reflects token refill over time', async () => {
      await limiter.acquire();
      await limiter.acquire();
      expect(limiter.getAvailableTokens()).toBe(0);

      vi.advanceTimersByTime(500); // 1 token at 2/s
      await Promise.resolve();

      expect(limiter.getAvailableTokens()).toBe(1);
    });
  });
});

describe('Factory Functions', () => {
  beforeEach(() => {
    resetRateLimiters();
    mockConfigReturnValue = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('createRateLimiter creates new instance each time', () => {
    const limiter1 = createRateLimiter({ requestsPerSecond: 5 });
    const limiter2 = createRateLimiter({ requestsPerSecond: 5 });

    expect(limiter1).not.toBe(limiter2);
  });

  test('getEmbeddingRateLimiter returns singleton', () => {
    const limiter1 = getEmbeddingRateLimiter();
    const limiter2 = getEmbeddingRateLimiter();

    expect(limiter1).toBe(limiter2);
  });

  test('getLLMRateLimiter returns singleton', () => {
    const limiter1 = getLLMRateLimiter();
    const limiter2 = getLLMRateLimiter();

    expect(limiter1).toBe(limiter2);
  });

  test('embedding and LLM limiters are separate instances', () => {
    const embeddingLimiter = getEmbeddingRateLimiter();
    const llmLimiter = getLLMRateLimiter();

    expect(embeddingLimiter).not.toBe(llmLimiter);
  });
});

describe('Config Integration', () => {
  beforeEach(() => {
    resetRateLimiters();
    mockConfigReturnValue = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('getEmbeddingRateLimiter uses default values when no config', () => {
    mockConfigReturnValue = null;
    const limiter = getEmbeddingRateLimiter();
    // Default: 5 rps, burst 10
    expect(limiter.getAvailableTokens()).toBe(10);
  });

  test('getEmbeddingRateLimiter uses config values when available', () => {
    mockConfigReturnValue = {
      ratelimit: {
        embedding: { requestsPerSecond: 10, burstSize: 25 },
      },
    };
    const limiter = getEmbeddingRateLimiter();
    expect(limiter.getAvailableTokens()).toBe(25);
  });

  test('getLLMRateLimiter uses default values when no config', () => {
    mockConfigReturnValue = null;
    const limiter = getLLMRateLimiter();
    // Default: 2 rps, burst 4
    expect(limiter.getAvailableTokens()).toBe(4);
  });

  test('getLLMRateLimiter uses config values when available', () => {
    mockConfigReturnValue = {
      ratelimit: {
        llm: { requestsPerSecond: 5, burstSize: 15 },
      },
    };
    const limiter = getLLMRateLimiter();
    expect(limiter.getAvailableTokens()).toBe(15);
  });

  test('getEmbeddingRateLimiter uses default burst when only rps specified', () => {
    mockConfigReturnValue = {
      ratelimit: {
        embedding: { requestsPerSecond: 8 },
      },
    };
    const limiter = getEmbeddingRateLimiter();
    // Burst should be 8 * 2 = 16 (default multiplier)
    expect(limiter.getAvailableTokens()).toBe(16);
  });

  test('getLLMRateLimiter uses default burst when only rps specified', () => {
    mockConfigReturnValue = {
      ratelimit: {
        llm: { requestsPerSecond: 3 },
      },
    };
    const limiter = getLLMRateLimiter();
    // Burst should be 3 * 2 = 6 (default multiplier)
    expect(limiter.getAvailableTokens()).toBe(6);
  });

  test('both limiters use separate config values', () => {
    mockConfigReturnValue = {
      ratelimit: {
        embedding: { requestsPerSecond: 10, burstSize: 30 },
        llm: { requestsPerSecond: 1, burstSize: 2 },
      },
    };
    const embLimiter = getEmbeddingRateLimiter();
    const llmLimiter = getLLMRateLimiter();
    expect(embLimiter.getAvailableTokens()).toBe(30);
    expect(llmLimiter.getAvailableTokens()).toBe(2);
  });
});

describe('Integration Scenarios', () => {
  test('handles rapid consecutive requests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const limiter = new RateLimiter({ requestsPerSecond: 5, burstSize: 3 });

    // Start 5 requests rapidly
    const promises = [
      limiter.acquire(),
      limiter.acquire(),
      limiter.acquire(),
      limiter.acquire(),
      limiter.acquire(),
    ];

    // First 3 should be immediate, last 2 delayed
    const results = await Promise.all([
      promises[0].then(() => 'done1'),
      promises[1].then(() => 'done2'),
      promises[2].then(() => 'done3'),
    ]);

    expect(results).toEqual(['done1', 'done2', 'done3']);

    // Advance time to allow remaining requests
    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();

    const remaining = await Promise.all([
      promises[3].then(() => 'done4'),
      promises[4].then(() => 'done5'),
    ]);

    expect(remaining).toEqual(['done4', 'done5']);

    vi.useRealTimers();
  });

  test('respects rate limit over extended period', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const limiter = new RateLimiter({ requestsPerSecond: 2, burstSize: 2 });

    const timestamps: number[] = [];

    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      limiter.acquire().then(() => {
        timestamps.push(Date.now());
      });
    }

    // Flush microtask queue so immediate promises record their timestamps
    await Promise.resolve();

    // Advance time enough for all to complete
    vi.advanceTimersByTime(2000);
    await vi.runAllTimersAsync();

    expect(timestamps).toHaveLength(5);

    // Check timing: first 2 at 0, then at 500ms intervals
    expect(timestamps[0]).toBe(0);
    expect(timestamps[1]).toBe(0);
    expect(timestamps[2]).toBeGreaterThanOrEqual(500);
    expect(timestamps[3]).toBeGreaterThanOrEqual(1000);
    expect(timestamps[4]).toBeGreaterThanOrEqual(1500);

    vi.useRealTimers();
  });
});
