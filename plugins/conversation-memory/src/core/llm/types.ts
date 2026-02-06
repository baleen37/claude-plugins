/**
 * Token usage information for LLM API calls.
 * Matches the TokenUsage interface from summarizer.ts for compatibility.
 */
export interface TokenUsage {
  /** Number of input tokens consumed */
  input_tokens: number;
  /** Number of output tokens generated */
  output_tokens: number;
  /** Optional: number of cache read input tokens */
  cache_read_input_tokens?: number;
  /** Optional: number of cache creation input tokens */
  cache_creation_input_tokens?: number;
}

/**
 * Options for LLM completion requests.
 */
export interface LLMOptions {
  /** Maximum number of tokens to generate */
  maxTokens?: number;
  /** System prompt to guide the model's behavior */
  systemPrompt?: string;
}

/**
 * Result from an LLM completion request.
 */
export interface LLMResult {
  /** The generated text response */
  text: string;
  /** Token usage information for this request */
  usage: TokenUsage;
}

/**
 * Interface for LLM providers.
 * Implementations can wrap different LLM backends (Anthropic, Google Gemini, etc.).
 */
export interface LLMProvider {
  /**
   * Complete a prompt using the LLM provider.
   *
   * @param prompt - The user prompt to complete
   * @param options - Optional configuration for the completion
   * @returns Promise resolving to the completion result with token usage
   */
  complete(prompt: string, options?: LLMOptions): Promise<LLMResult>;
}
