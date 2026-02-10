#!/usr/bin/env node
/**
 * Test RoundRobinProvider behavior with single provider
 */

import { loadConfig, createProvider } from './src/core/llm/index.js';

async function main() {
  console.log('Testing RoundRobinProvider with single API key...\n');

  const config = loadConfig();
  if (!config) {
    console.error('No config found');
    process.exit(1);
  }

  // Create provider using the factory
  const provider = await createProvider(config);

  console.log('Provider type:', provider.constructor.name);

  // Test multiple sequential calls
  console.log('\nMaking 3 sequential API calls to test round-robin...\n');

  const testPrompt = 'Say "Hello"';
  for (let i = 1; i <= 3; i++) {
    const result = await provider.complete(testPrompt);
    console.log(`Call ${i}: "${result.text.trim()}" (Input: ${result.usage.input_tokens}, Output: ${result.usage.output_tokens})`);
  }

  console.log('\n✓ All calls succeeded - RoundRobinProvider working correctly with single provider');
}

main().catch(console.error);
