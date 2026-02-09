/**
 * LLM Module - Barrel Export
 *
 * This module provides a clean entry point for all LLM-related functionality.
 * Re-exports all public types, classes, and functions from submodules.
 *
 * @example
 * ```ts
 * import { createProvider, loadConfig, LLMProvider } from './llm';
 *
 * const config = loadConfig();
 * if (config) {
 *   const provider = createProvider(config);
 *   const result = await provider.complete('Summarize this');
 * }
 * ```
 */

// Types from types.ts
export type { LLMProvider, LLMOptions, LLMResult, TokenUsage } from './types.js';

// Classes from gemini-provider.ts
export { GeminiProvider } from './gemini-provider.js';

// Types and functions from config.ts
export type { LLMConfig } from './config.js';
export { loadConfig, createProvider } from './config.js';

// Types and functions from batch-extract-prompt.ts
export type {
  CompressedEvent,
  ExtractedObservation,
  PreviousObservation,
} from './batch-extract-prompt.js';
export {
  buildBatchExtractPrompt,
  parseBatchExtractResponse,
  extractObservationsFromBatch,
} from './batch-extract-prompt.js';
