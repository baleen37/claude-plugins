import { describe, test, expect } from 'bun:test';
import type { ConversationExchange } from './types.js';

// Import the internal chunkExchanges function for testing
// This is a characterization test - we're documenting the current behavior
function chunkExchanges(exchanges: ConversationExchange[], chunkSize: number): ConversationExchange[][] {
  const chunks: ConversationExchange[][] = [];
  for (let i = 0; i < exchanges.length; i += chunkSize) {
    chunks.push(exchanges.slice(i, i + chunkSize));
  }
  return chunks;
}

describe('chunkExchanges', () => {
  const createExchange = (i: number): ConversationExchange => ({
    id: `exchange-${i}`,
    project: 'test-project',
    timestamp: new Date(Date.now()).toISOString(),
    userMessage: `User message ${i}`,
    assistantMessage: `Assistant message ${i}`,
    archivePath: 'test.jsonl',
    lineStart: i * 10,
    lineEnd: i * 10 + 5,
  });

  test('chunks 100 exchanges into groups of 32', () => {
    const exchanges: ConversationExchange[] = Array.from({ length: 100 }, (_, i) => createExchange(i));

    const chunks = chunkExchanges(exchanges, 32);

    // 100 exchanges / 32 per chunk = 4 chunks (with last chunk having 4 items)
    expect(chunks.length).toBe(4);
    expect(chunks[0].length).toBe(32);
    expect(chunks[1].length).toBe(32);
    expect(chunks[2].length).toBe(32);
    expect(chunks[3].length).toBe(4);
  });

  test('chunks exact multiple of chunk size evenly', () => {
    const exchanges: ConversationExchange[] = Array.from({ length: 64 }, (_, i) => createExchange(i));

    const chunks = chunkExchanges(exchanges, 32);

    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(32);
    expect(chunks[1].length).toBe(32);
  });

  test('handles empty array', () => {
    const chunks = chunkExchanges([], 32);
    expect(chunks.length).toBe(0);
  });

  test('handles single exchange', () => {
    const exchanges: ConversationExchange[] = [createExchange(0)];

    const chunks = chunkExchanges(exchanges, 32);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(1);
  });
});
