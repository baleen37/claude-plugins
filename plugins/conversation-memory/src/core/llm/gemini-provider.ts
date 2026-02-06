/**
 * GeminiProvider - LLM provider implementation using Google's Gemini API.
 *
 * This provider uses the @google/generative-ai SDK.
 * It implements the LLMProvider interface to enable conversation summarization with Gemini models.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  GenerationConfig,
  GenerateContentResult,
  EnhancedGenerateContentResponse,
  ModelParams,
} from '@google/generative-ai';
import type { LLMProvider, LLMOptions, LLMResult, TokenUsage } from './types.js';

/**
 * Default model to use for Gemini API calls.
 * gemini-2.0-flash is fast and cost-effective for summarization tasks.
 */
const DEFAULT_MODEL = 'gemini-2.0-flash';

/**
 * LLM provider implementation using Google's Gemini API.
 *
 * @example
 * ```ts
 * const provider = new GeminiProvider('your-api-key', 'gemini-2.0-flash');
 * const result = await provider.complete('Summarize this text');
 * console.log(result.text); // The generated summary
 * console.log(result.usage); // Token usage information
 * ```
 */
export class GeminiProvider implements LLMProvider {
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;

  /**
   * Creates a new GeminiProvider instance.
   *
   * @param apiKey - Google API key for authentication
   * @param model - Model name to use (default: gemini-2.0-flash)
   * @throws {Error} If API key is not provided
   */
  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    if (!apiKey) {
      throw new Error('GeminiProvider requires an API key');
    }

    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  /**
   * Completes a prompt using the Gemini API.
   *
   * @param prompt - The user prompt to complete
   * @param options - Optional configuration for the completion
   * @returns Promise resolving to the completion result with token usage
   * @throws {Error} If the API call fails
   */
  async complete(prompt: string, options?: LLMOptions): Promise<LLMResult> {
    try {
      const generationConfig: GenerationConfig = {};
      if (options?.maxTokens) {
        generationConfig.maxOutputTokens = options.maxTokens;
      }

      const modelParams: ModelParams = { model: this.model };
      if (options?.systemPrompt) {
        modelParams.systemInstruction = options.systemPrompt;
      }
      if (Object.keys(generationConfig).length > 0) {
        modelParams.generationConfig = generationConfig;
      }

      const generativeModel = this.client.getGenerativeModel(modelParams);

      const result = await generativeModel.generateContent(prompt);
      return this.parseResult(result);
    } catch (error) {
      // Re-throw API errors directly for the caller to handle
      throw new Error(
        `Gemini API call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parses a Gemini API response into an LLMResult.
   *
   * @param result - The raw API response from Gemini
   * @returns Parsed LLM result with text and token usage
   */
  private parseResult(result: GenerateContentResult): LLMResult {
    const response = result.response;
    const text = response.text() ?? '';
    const usage = this.extractUsage(response);

    return { text, usage };
  }

  /**
   * Extracts token usage information from a Gemini API response.
   *
   * Note: Gemini API may not return cache-related token usage fields.
   * These fields will be undefined in the returned TokenUsage object.
   *
   * @param response - The response object from Gemini
   * @returns Token usage information
   */
  private extractUsage(response: EnhancedGenerateContentResponse): TokenUsage {
    const usageMetadata = response.usageMetadata;

    return {
      input_tokens: usageMetadata?.promptTokenCount ?? 0,
      output_tokens: usageMetadata?.candidatesTokenCount ?? 0,
      // Gemini doesn't provide cache-related token usage
      cache_read_input_tokens: undefined,
      cache_creation_input_tokens: undefined,
    };
  }
}
