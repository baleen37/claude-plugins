/**
 * Global Rate Limiter Module
 *
 * Implements a token bucket algorithm for rate limiting.
 * Used to throttle embedding generation and LLM API calls.
 *
 * Features:
 * - Token bucket with configurable refill rate
 * - Burst support via bucket capacity
 * - Non-blocking tryAcquire for immediate feedback
 * - Singleton instances for embedding and LLM rate limiting
 * - Configurable via ~/.config/conversation-memory/config.json
 */

import { loadConfig } from './llm/config.js';

export interface RateLimiterConfig {
  /** Maximum requests per second (token refill rate) */
  requestsPerSecond?: number;
  /** Maximum tokens in bucket (burst capacity) */
  burstSize?: number;
}

/** Default requests per second for embedding generation */
const DEFAULT_EMBEDDING_RPS = 5;

/** Default requests per second for LLM calls */
const DEFAULT_LLM_RPS = 2;

/** Default burst multiplier (burst = rps * multiplier) */
const DEFAULT_BURST_MULTIPLIER = 2;

/**
 * Token bucket rate limiter.
 *
 * The bucket starts full and tokens are consumed on each request.
 * Tokens refill at the configured rate up to the burst capacity.
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond
  private lastRefill: number;
  private queue: Array<() => void> = [];

  /**
   * Creates a new RateLimiter instance.
   *
   * @param config - Configuration options
   */
  constructor(config: RateLimiterConfig = {}) {
    const rps = config.requestsPerSecond ?? 5;
    this.maxTokens = config.burstSize ?? rps * DEFAULT_BURST_MULTIPLIER;
    this.tokens = this.maxTokens;
    this.refillRate = rps / 1000; // Convert to tokens per millisecond
    this.lastRefill = Date.now();
  }

  /**
   * Refills tokens based on elapsed time.
   * Called internally before token operations.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed > 0) {
      const newTokens = elapsed * this.refillRate;
      this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }

  /**
   * Acquires a token, waiting if necessary.
   *
   * @returns Promise that resolves when a token is available
   */
  acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return Promise.resolve();
    }

    // Queue the request
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.scheduleQueueProcessing();
    });
  }

  /**
   * Schedules processing of the queue if not already scheduled.
   */
  private scheduleQueueProcessing(): void {
    // Calculate when the next token will be available
    const tokensNeeded = 1 - this.tokens;
    const waitMs = Math.ceil(tokensNeeded / this.refillRate);

    setTimeout(() => {
      this.processQueue();
    }, waitMs);
  }

  /**
   * Tries to acquire a token without waiting.
   *
   * @returns true if token was acquired, false if rate limited
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Gets the current number of available tokens.
   *
   * @returns Number of tokens available (may be fractional)
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Processes queued requests if tokens are available.
   */
  private processQueue(): void {
    this.refill();

    while (this.queue.length > 0 && this.tokens >= 1) {
      const next = this.queue.shift();
      if (next) {
        this.tokens -= 1;
        next();
      }
    }

    // If there are still queued requests, schedule more processing
    if (this.queue.length > 0) {
      this.scheduleQueueProcessing();
    }
  }
}

// Singleton instances
let embeddingLimiter: RateLimiter | null = null;
let llmLimiter: RateLimiter | null = null;

/**
 * Creates a new RateLimiter instance.
 *
 * @param config - Configuration options
 * @returns New RateLimiter instance
 */
export function createRateLimiter(config?: RateLimiterConfig): RateLimiter {
  return new RateLimiter(config);
}

/**
 * Gets the singleton rate limiter for embedding generation.
 *
 * Reads configuration from ~/.config/conversation-memory/config.json if available.
 * Default: 5 requests per second, burst of 10
 *
 * @returns RateLimiter instance for embeddings
 */
export function getEmbeddingRateLimiter(): RateLimiter {
  if (!embeddingLimiter) {
    const config = loadConfig();
    const ratelimitConfig = config?.ratelimit?.embedding;
    const rps = ratelimitConfig?.requestsPerSecond ?? DEFAULT_EMBEDDING_RPS;
    embeddingLimiter = new RateLimiter({
      requestsPerSecond: rps,
      burstSize: ratelimitConfig?.burstSize ?? rps * DEFAULT_BURST_MULTIPLIER,
    });
  }
  return embeddingLimiter;
}

/**
 * Gets the singleton rate limiter for LLM API calls.
 *
 * Reads configuration from ~/.config/conversation-memory/config.json if available.
 * Default: 2 requests per second, burst of 4
 *
 * @returns RateLimiter instance for LLM calls
 */
export function getLLMRateLimiter(): RateLimiter {
  if (!llmLimiter) {
    const config = loadConfig();
    const ratelimitConfig = config?.ratelimit?.llm;
    const rps = ratelimitConfig?.requestsPerSecond ?? DEFAULT_LLM_RPS;
    llmLimiter = new RateLimiter({
      requestsPerSecond: rps,
      burstSize: ratelimitConfig?.burstSize ?? rps * DEFAULT_BURST_MULTIPLIER,
    });
  }
  return llmLimiter;
}

/**
 * Resets the singleton instances (for testing).
 */
export function resetRateLimiters(): void {
  embeddingLimiter = null;
  llmLimiter = null;
}
