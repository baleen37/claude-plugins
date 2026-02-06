#!/usr/bin/env node
/**
 * Integration Test for Gemini LLM Provider
 *
 * This script tests:
 * 1. Config loading from ~/.config/conversation-memory/config.json
 * 2. Provider creation from config
 * 3. Basic LLM completion using the actual Gemini API
 *
 * Usage:
 *   node test-integration.ts
 */

import { loadConfig, createProvider } from './src/core/llm/index.js';

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✓ ${message}`, 'green');
}

function error(message: string) {
  log(`✗ ${message}`, 'red');
}

function info(message: string) {
  log(`ℹ ${message}`, 'blue');
}

function section(message: string) {
  console.log('');
  log(`${colors.bold}${message}${colors.reset}`, 'yellow');
  log('='.repeat(message.length), 'yellow');
}

async function testConfigLoading() {
  section('TEST 1: Config Loading');

  const config = loadConfig();

  if (!config) {
    error('Config loading failed: loadConfig() returned null');
    info('Expected: config file at ~/.config/conversation-memory/config.json');
    return false;
  }

  success('Config loaded successfully');
  info(`Provider: ${config.provider}`);

  if (config.provider !== 'gemini') {
    error(`Expected provider "gemini", got "${config.provider}"`);
    return false;
  }

  success('Provider is "gemini"');

  if (!config.gemini) {
    error('Missing gemini configuration');
    return false;
  }

  success('Gemini config exists');
  info(`Model: ${config.gemini.model || 'default (gemini-2.0-flash)'}`);
  info(`API Keys count: ${config.gemini.apiKeys.length}`);

  if (config.gemini.apiKeys.length === 0) {
    error('No API keys configured');
    return false;
  }

  success('At least one API key is configured');

  return true;
}

async function testProviderCreation() {
  section('TEST 2: Provider Creation');

  const config = loadConfig();
  if (!config) {
    error('Cannot test provider creation: config is null');
    return false;
  }

  try {
    const provider = createProvider(config);
    success('Provider created successfully');

    if (typeof provider.complete !== 'function') {
      error('Provider does not have a complete() method');
      return false;
    }

    success('Provider has complete() method');
    return true;
  } catch (err) {
    error(`Provider creation failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function testSummarization() {
  section('TEST 3: Summarization (API Call)');

  const config = loadConfig();
  if (!config) {
    error('Cannot test summarization: config is null');
    return false;
  }

  const provider = createProvider(config);

  const testPrompt = 'Summarize this in one word: Hello world, this is a test.';
  info(`Test prompt: "${testPrompt}"`);

  try {
    const result = await provider.complete(testPrompt);
    success('API call succeeded');
    info(`Response: "${result.text.trim()}"`);
    info(`Input tokens: ${result.usage.input_tokens}`);
    info(`Output tokens: ${result.usage.output_tokens}`);

    if (result.usage.cache_read_input_tokens !== undefined) {
      info(`Cache read tokens: ${result.usage.cache_read_input_tokens}`);
    }

    if (result.usage.cache_creation_input_tokens !== undefined) {
      info(`Cache creation tokens: ${result.usage.cache_creation_input_tokens}`);
    }

    return true;
  } catch (err) {
    error(`API call failed: ${err instanceof Error ? err.message : String(err)}`);
    info('This is expected if API key is invalid or quota exceeded');
    return false;
  }
}

async function main() {
  console.log('');
  log('╔═══════════════════════════════════════════════════════════╗', 'bold');
  log('║   Gemini LLM Integration Test                            ║', 'bold');
  log('║   conversation-memory Plugin                              ║', 'bold');
  log('╚═══════════════════════════════════════════════════════════╝', 'bold');

  const results = {
    configLoading: await testConfigLoading(),
    providerCreation: await testProviderCreation(),
    summarization: await testSummarization(),
  };

  section('RESULTS');

  if (results.configLoading) {
    success('Config loading: PASSED');
  } else {
    error('Config loading: FAILED');
  }

  if (results.providerCreation) {
    success('Provider creation: PASSED');
  } else {
    error('Provider creation: FAILED');
  }

  if (results.summarization) {
    success('Summarization: PASSED');
  } else {
    error('Summarization: FAILED (may be expected - see details above)');
  }

  section('OVERALL ASSESSMENT');

  if (results.configLoading && results.providerCreation) {
    success('Core integration is working correctly');
    info('The LLM provider abstraction is properly configured');

    if (results.summarization) {
      success('Full integration test passed - API calls are working');
      info('The conversation-memory plugin is ready for use');
    } else {
      info('API call test failed - check API key and quota');
      info('Core functionality is working, but API access has issues');
    }
  } else {
    error('Integration test failed - core functionality is broken');
    info('Please check the configuration and implementation');
  }

  console.log('');

  // Exit with appropriate code
  const allPassed = results.configLoading && results.providerCreation && results.summarization;
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
