/**
 * LLM Configuration for Stop Hook Batch Extraction
 *
 * This module provides:
 * - LLMConfig interface for configuration file structure
 * - loadConfig() function to read configuration from ~/.config/conversation-memory/config.json
 * - createProvider() factory function to create LLMProvider instances from config
 *
 * Configuration file location: ~/.config/conversation-memory/config.json
 *
 * @example
 * ```json
 * {
 *   "apiKey": "your-gemini-api-key",
 *   "model": "gemini-2.0-flash"
 * }
 * ```
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { LLMProvider } from './types.js';
import { GeminiProvider } from './gemini-provider.js';

/**
 * Default model to use for Gemini API calls.
 * gemini-2.0-flash is fast and cost-effective for batch extraction.
 */
const DEFAULT_MODEL = 'gemini-2.0-flash';

/**
 * LLM configuration interface.
 *
 * Defines the structure of the config file at ~/.config/conversation-memory/config.json
 */
export interface LLMConfig {
  /** Gemini API key */
  apiKey: string;
  /** Optional model name (defaults to gemini-2.0-flash) */
  model?: string;
}

/**
 * Loads LLM configuration from the config file.
 *
 * Reads ~/.config/conversation-memory/config.json and parses it.
 *
 * @returns LLMConfig if file exists and is valid, null otherwise
 *
 * @example
 * ```ts
 * const config = loadConfig();
 * if (config) {
 *   const provider = createProvider(config);
 * } else {
 *   console.log('No config file found');
 * }
 * ```
 */
export function loadConfig(): LLMConfig | null {
  const configDir = join(process.env.HOME ?? '', '.config', 'conversation-memory');
  const configPath = join(configDir, 'config.json');

  // Return null if config file doesn't exist
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent) as LLMConfig;

    // Validate required fields
    if (!config.apiKey) {
      console.warn('Invalid config: missing apiKey field');
      return null;
    }

    return config;
  } catch (error) {
    console.warn(
      `Failed to load config from ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Creates an LLMProvider from configuration.
 *
 * Creates a GeminiProvider with the specified API key and model.
 * Uses gemini-2.0-flash as the default model if not specified.
 *
 * @param config - LLM configuration object
 * @returns Configured GeminiProvider instance
 * @throws {Error} If apiKey is missing
 *
 * @example
 * ```ts
 * const config: LLMConfig = {
 *   apiKey: 'your-api-key',
 *   model: 'gemini-2.0-flash'
 * };
 * const provider = createProvider(config);
 * const result = await provider.complete('Extract observations');
 * ```
 */
export function createProvider(config: LLMConfig): LLMProvider {
  const { apiKey, model = DEFAULT_MODEL } = config;

  if (!apiKey) {
    throw new Error('Gemini provider requires an apiKey');
  }

  return new GeminiProvider(apiKey, model);
}
