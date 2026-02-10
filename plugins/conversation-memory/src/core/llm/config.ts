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
 *   "provider": "gemini",
 *   "apiKey": "your-gemini-api-key",
 *   "model": "gemini-2.0-flash"
 * }
 * ```
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { LLMProvider } from './types.js';

/**
 * Supported LLM provider types.
 */
export type LLMProviderType = 'gemini' | 'zhipu-ai';

/**
 * Default models for each provider.
 */
const DEFAULT_MODELS = {
  gemini: 'gemini-2.0-flash',
  'zhipu-ai': 'glm-4.7'
} as const;

/**
 * LLM configuration interface.
 *
 * Defines the structure of the config file at ~/.config/conversation-memory/config.json
 */
export interface LLMConfig {
  /** Provider: 'gemini' or 'zhipu-ai' */
  provider: LLMProviderType;
  /** API key for the provider */
  apiKey: string;
  /** Optional model name (defaults depend on provider) */
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
    if (!config.provider || !config.apiKey) {
      console.warn('Invalid config: missing provider or apiKey field');
      return null;
    }

    // Validate provider value
    if (config.provider !== 'gemini' && config.provider !== 'zhipu-ai') {
      console.warn(`Invalid config: unknown provider "${config.provider}"`);
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
 * Supports both 'gemini' and 'zhipu-ai' providers.
 * Uses provider-specific default models if not specified.
 *
 * @param config - LLM configuration object
 * @returns Configured LLMProvider instance
 * @throws {Error} If apiKey is missing or provider is unknown
 *
 * @example
 * ```ts
 * const config: LLMConfig = {
 *   provider: 'gemini',
 *   apiKey: 'your-api-key',
 *   model: 'gemini-2.0-flash'
 * };
 * const provider = await createProvider(config);
 * const result = await provider.complete('Extract observations');
 * ```
 */
export async function createProvider(config: LLMConfig): Promise<LLMProvider> {
  const { provider, apiKey, model } = config;

  if (!apiKey) {
    throw new Error('Provider requires an apiKey');
  }

  const defaultModel = model ?? DEFAULT_MODELS[provider];

  if (provider === 'gemini') {
    const { GeminiProvider } = await import('./gemini-provider.js');
    return new GeminiProvider(apiKey, defaultModel);
  } else if (provider === 'zhipu-ai') {
    const { ZhipuAIProvider } = await import('./zhipu-provider.js');
    return new ZhipuAIProvider(apiKey, defaultModel);
  }

  throw new Error(`Unknown provider: ${provider}`);
}
