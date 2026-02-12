/**
 * ZAIProvider - LLM provider implementation using Z.AI's GLM API.
 *
 * This provider uses native fetch (no SDK) for minimal dependencies.
 * It implements the LLMProvider interface to enable conversation summarization with GLM models.
 */

import type { LLMProvider, LLMOptions, LLMResult, TokenUsage } from './types.js';
import { logInfo, logError, logDebug } from '../logger.js';

/**
 * Type definition for Z.AI completion request message.
 */
type Message = {
  role: 'system' | 'user';
  content: string;
};

/**
 * Type definition for Z.AI chat completion response.
 */
interface ChatCompletionResponse {
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Type definition for Z.AI API error response.
 */
interface APIErrorResponse {
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}

/**
 * Default model to use for Z.AI API calls.
 * glm-4.5-air is optimized for fast responses.
 */
const DEFAULT_MODEL = 'glm-4.5-air';

/**
 * Base URL for Z.AI Coding API.
 */
const DEFAULT_BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

/**
 * LLM provider implementation using Z.AI's GLM API with native fetch.
 *
 * @example
 * ```ts
 * const provider = new ZAIProvider('your-api-key', 'glm-4.7');
 * const result = await provider.complete('Summarize this text');
 * console.log(result.text); // The generated summary
 * console.log(result.usage); // Token usage information
 * ```
 */
export class ZAIProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  /**
   * Creates a new ZAIProvider instance.
   *
   * @param apiKey - Z.AI API key for authentication
   * @param model - Model name to use (default: glm-4.7)
   * @param baseUrl - Base URL for API (default: https://api.z.ai/api/paas/v4)
   * @throws {Error} If API key is not provided
   */
  constructor(apiKey: string, model: string = DEFAULT_MODEL, baseUrl: string = DEFAULT_BASE_URL) {
    if (!apiKey) {
      throw new Error('ZAIProvider requires an API key');
    }

    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }

  /**
   * Completes a prompt using the Z.AI API.
   *
   * @param prompt - The user prompt to complete
   * @param options - Optional configuration for the completion
   * @returns Promise resolving to the completion result with token usage
   * @throws {Error} If the API call fails
   */
  async complete(prompt: string, options?: LLMOptions): Promise<LLMResult> {
    const startTime = Date.now();

    logInfo('[ZAIProvider] Starting completion', {
      model: this.model,
      promptLength: prompt.length,
      maxTokens: options?.maxTokens
    });

    try {
      const messages: Message[] = [];
      if (options?.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const requestBody = {
        model: this.model,
        messages,
        temperature: 1.0,
        max_tokens: options?.maxTokens,
        stream: false
      };

      logDebug('[ZAIProvider] Sending request', {
        model: this.model,
        messagesCount: messages.length,
        hasSystemPrompt: !!options?.systemPrompt
      });

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept-Language': 'en-US,en'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errorData: APIErrorResponse = {};
        try {
          errorData = await response.json() as APIErrorResponse;
        } catch {
          // Use empty errorData if JSON parsing fails
        }
        const errorMessage = errorData.error?.message || response.statusText;
        throw new Error(`Z.AI API request failed (${response.status}): ${errorMessage}`);
      }

      const data = await response.json() as ChatCompletionResponse;
      const duration = Date.now() - startTime;

      const text = data.choices?.[0]?.message?.content ?? '';
      const usage = this.extractUsage(data);

      logInfo('[ZAIProvider] Completion successful', {
        duration,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        responseLength: text.length
      });

      return { text, usage };
    } catch (error) {
      const duration = Date.now() - startTime;
      logError('[ZAIProvider] Completion failed', error, {
        model: this.model,
        duration
      });
      // Re-throw API errors directly for the caller to handle
      throw error;
    }
  }

  /**
   * Extracts token usage information from a Z.AI API response.
   *
   * @param response - The response object from Z.AI
   * @returns Token usage information
   */
  private extractUsage(response: ChatCompletionResponse): TokenUsage {
    const usage = response.usage;

    return {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
      // Z.AI doesn't provide cache-related token usage
      cache_read_input_tokens: undefined,
      cache_creation_input_tokens: undefined,
    };
  }
}
