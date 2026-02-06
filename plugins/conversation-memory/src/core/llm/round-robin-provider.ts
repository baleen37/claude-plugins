/**
 * RoundRobinProvider - LLM provider that distributes requests across multiple providers.
 *
 * This provider implements a simple round-robin strategy to distribute load across
 * multiple LLM providers, useful for:
 * - Rate limit distribution across multiple API keys/accounts
 * - Load balancing when using multiple LLM services
 * - Reducing dependency on a single provider
 *
 * No automatic retry or failover - if a provider fails, the error is propagated
 * directly to the caller. This ensures predictable behavior for rate limit handling.
 *
 * @example
 * ```ts
 * const provider = new RoundRobinProvider([
 *   new GeminiProvider(process.env.GEMINI_API_KEY_1!),
 *   new GeminiProvider(process.env.GEMINI_API_KEY_2!),
 *   new GeminiProvider(process.env.GEMINI_API_KEY_3!),
 * ]);
 *
 * const result = await provider.complete('Summarize this text');
 * // Distributes requests across all three providers
 * ```
 */

import type { LLMProvider, LLMOptions, LLMResult } from './types.js';

/**
 * LLM provider that cycles through multiple providers in round-robin fashion.
 */
export class RoundRobinProvider implements LLMProvider {
  private index: number = 0;

  /**
   * Creates a new RoundRobinProvider instance.
   *
   * @param providers - Array of LLM providers to distribute requests across
   */
  constructor(private readonly providers: LLMProvider[]) {}

  /**
   * Completes a prompt using the next provider in the round-robin cycle.
   *
   * Providers are selected using modulo arithmetic: `index % providers.length`
   * The index increments after each call, ensuring even distribution.
   *
   * @param prompt - The user prompt to complete
   * @param options - Optional configuration for the completion
   * @returns Promise resolving to the completion result with token usage
   * @throws {Error} If no providers are configured
   * @throws {Error} If the selected provider fails (no retry/failover)
   */
  async complete(prompt: string, options?: LLMOptions): Promise<LLMResult> {
    if (this.providers.length === 0) {
      throw new Error('No providers configured');
    }

    const provider = this.providers[this.index % this.providers.length];
    this.index++;

    return provider.complete(prompt, options);
  }
}
