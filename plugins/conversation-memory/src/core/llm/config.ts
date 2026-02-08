/**
 * LLM Configuration and Provider Factory
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
 *   "gemini": {
 *     "apiKeys": ["key1", "key2", "key3"],
 *     "model": "gemini-2.0-flash"
 *   }
 * }
 * ```
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { LLMProvider } from './types.js';
import { GeminiProvider } from './gemini-provider.js';
import { RoundRobinProvider } from './round-robin-provider.js';

/**
 * Default model to use for Gemini API calls.
 * gemini-2.0-flash is fast and cost-effective for summarization tasks.
 */
const DEFAULT_MODEL = 'gemini-2.0-flash';

/**
 * LLM configuration interface.
 *
 * Defines the structure of the config file at ~/.config/conversation-memory/config.json
 */
export interface LLMConfig {
  /** Provider name (e.g., "gemini") */
  provider: string;
  /** Gemini-specific configuration */
  gemini?: {
    /** Array of API keys for round-robin distribution */
    apiKeys: string[];
    /** Optional model name (defaults to gemini-2.0-flash) */
    model?: string;
  };
  /** Optional list of tool names to skip during observation */
  skipTools?: string[];
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
    if (!config.provider) {
      console.warn('Invalid config: missing provider field');
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
 * For "gemini" provider:
 * - Creates multiple GeminiProviders from the apiKeys array
 * - Wraps them in a RoundRobinProvider for load distribution
 * - Uses the specified model or defaults to gemini-2.0-flash
 *
 * @param config - LLM configuration object
 * @returns Configured LLMProvider instance
 * @throws {Error} If apiKeys array is empty
 * @throws {Error} If provider name is unknown
 * @throws {Error} If gemini config is missing for gemini provider
 *
 * @example
 * ```ts
 * const config: LLMConfig = {
 *   provider: 'gemini',
 *   gemini: {
 *     apiKeys: ['key1', 'key2', 'key3'],
 *     model: 'gemini-2.0-flash'
 *   }
 * };
 * const provider = createProvider(config);
 * const result = await provider.complete('Summarize this');
 * ```
 */
export function createProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'gemini': {
      const geminiConfig = config.gemini;
      if (!geminiConfig) {
        throw new Error('Gemini provider requires gemini configuration');
      }

      const { apiKeys, model = DEFAULT_MODEL } = geminiConfig;

      if (apiKeys.length === 0) {
        throw new Error('Gemini provider requires at least one API key');
      }

      // Create multiple GeminiProviders, one for each API key
      const providers = apiKeys.map((apiKey) => new GeminiProvider(apiKey, model));

      // Wrap in RoundRobinProvider for load distribution
      // If only one provider, RoundRobinProvider will still work (just always returns index 0)
      return new RoundRobinProvider(providers);
    }

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
