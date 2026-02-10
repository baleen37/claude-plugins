/**
 * ZhipuAIProvider - LLM provider implementation using Zhipu AI's GLM API.
 *
 * This provider uses the zhipuai-sdk-nodejs-v4 SDK.
 * It implements the LLMProvider interface to enable conversation summarization with GLM-4 models.
 */

import { ZhipuAI } from 'zhipuai-sdk-nodejs-v4';
import type { LLMProvider, LLMOptions, LLMResult, TokenUsage } from './types.js';
import { logInfo, logError, logDebug } from '../logger.js';

/**
 * Type definition for Zhipu AI completion response message.
 * Based on the zhipuai-sdk-nodejs-v4 package types.
 */
type CompletionsResponseMessage = {
  id: string;
  created: number;
  model: string;
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
};

/**
 * Default model to use for Zhipu AI API calls.
 * glm-4.7 is the latest flagship model.
 */
const DEFAULT_MODEL = 'glm-4.7';

/**
 * LLM provider implementation using Zhipu AI's GLM API.
 *
 * @example
 * ```ts
 * const provider = new ZhipuAIProvider('your-api-key', 'glm-4.7');
 * const result = await provider.complete('Summarize this text');
 * console.log(result.text); // The generated summary
 * console.log(result.usage); // Token usage information
 * ```
 */
export class ZhipuAIProvider implements LLMProvider {
  private readonly client: ZhipuAI;
  private readonly model: string;

  /**
   * Creates a new ZhipuAIProvider instance.
   *
   * @param apiKey - Zhipu AI API key for authentication
   * @param model - Model name to use (default: glm-4.7)
   * @throws {Error} If API key is not provided
   */
  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    if (!apiKey) {
      throw new Error('ZhipuAIProvider requires an API key');
    }

    this.client = new ZhipuAI({
      apiKey,
      cacheToken: true
    });
    this.model = model;
  }

  /**
   * Completes a prompt using the Zhipu AI API.
   *
   * @param prompt - The user prompt to complete
   * @param options - Optional configuration for the completion
   * @returns Promise resolving to the completion result with token usage
   * @throws {Error} If the API call fails
   */
  async complete(prompt: string, options?: LLMOptions): Promise<LLMResult> {
    const startTime = Date.now();

    logInfo('[ZhipuAIProvider] Starting completion', {
      model: this.model,
      promptLength: prompt.length,
      maxTokens: options?.maxTokens
    });

    try {
      const messages: Array<{ role: 'user'; content: string }> = [
        { role: 'user', content: prompt }
      ];

      logDebug('[ZhipuAIProvider] Sending request', {
        model: this.model,
        messagesCount: messages.length
      });

      const response = await this.client.createCompletions({
        model: this.model,
        messages,
        stream: false,
        maxTokens: options?.maxTokens
      });
      const duration = Date.now() - startTime;

      // The response can be either CompletionsResponseMessage or IncomingMessage
      // We need to check which one we got
      const completionsResponse = response as CompletionsResponseMessage;
      const text = completionsResponse.choices?.[0]?.message?.content ?? '';
      const usage = this.extractUsage(completionsResponse);

      logInfo('[ZhipuAIProvider] Completion successful', {
        duration,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        responseLength: text.length
      });

      return { text, usage };
    } catch (error) {
      const duration = Date.now() - startTime;
      logError('[ZhipuAIProvider] Completion failed', error, {
        model: this.model,
        duration
      });
      // Re-throw API errors directly for the caller to handle
      throw error;
    }
  }

  /**
   * Extracts token usage information from a Zhipu AI API response.
   *
   * @param response - The response object from Zhipu AI
   * @returns Token usage information
   */
  private extractUsage(response: CompletionsResponseMessage): TokenUsage {
    const usage = response.usage;

    return {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
      cache_read_input_tokens: undefined,
      cache_creation_input_tokens: undefined,
    };
  }
}
