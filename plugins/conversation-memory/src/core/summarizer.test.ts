/**
 * Comprehensive tests for summarizer.ts
 *
 * Tests cover:
 * - formatConversationText(): formatting conversation exchanges
 * - extractSummary(): extracting summary from LLM response (via summarizeConversation)
 * - isTrivialConversation(): detecting trivial conversations (via summarizeConversation)
 * - summarizeConversation(): main summarization logic with LLM calls
 * - Token tracking functions
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatConversationText,
  summarizeConversation,
  startTokenTracking,
  getCurrentRunTokenUsage,
  trackTokenUsage,
} from './summarizer.js';
import type { ConversationExchange } from './types.js';
import type { LLMProvider, LLMResult } from './llm/types.js';

// Helper to create test exchanges
function createExchange(overrides: Partial<ConversationExchange> = {}): ConversationExchange {
  return {
    id: 'test-id',
    project: 'test-project',
    timestamp: new Date().toISOString(),
    userMessage: 'Test user message',
    assistantMessage: 'Test assistant message',
    archivePath: 'test.jsonl',
    lineStart: 0,
    lineEnd: 5,
    ...overrides,
  };
}

// Helper to create exchanges with specific word counts
function createExchangeWithWordCount(wordCount: number): ConversationExchange {
  const words = Array.from({ length: wordCount }, (_, i) => `word${i}`).join(' ');
  const halfLength = Math.floor(words.length / 2);
  return createExchange({
    userMessage: words.slice(0, halfLength),
    assistantMessage: words.slice(halfLength),
  });
}

// Mock provider instance - controlled via mock variables
let mockCompleteFn: vi.Mock<Promise<LLMResult>, [string, object?]>;

// Mock the LLM config module
vi.mock('./llm/config.js', () => ({
  loadConfig: vi.fn(() => ({
    provider: 'gemini',
    apiKey: 'test-api-key',
    model: 'test-model',
  })),
  createProvider: vi.fn(async () => {
    // Return the mock provider with our controlled complete function
    return {
      complete: mockCompleteFn,
    };
  }),
}));

describe('formatConversationText', () => {
  test('formats single exchange correctly', () => {
    const exchanges: ConversationExchange[] = [
      createExchange({
        userMessage: 'Hello',
        assistantMessage: 'Hi there!',
      }),
    ];

    const result = formatConversationText(exchanges);

    expect(result).toBe('User: Hello\n\nAgent: Hi there!');
  });

  test('formats multiple exchanges with separator', () => {
    const exchanges: ConversationExchange[] = [
      createExchange({
        userMessage: 'First question',
        assistantMessage: 'First answer',
      }),
      createExchange({
        userMessage: 'Second question',
        assistantMessage: 'Second answer',
      }),
    ];

    const result = formatConversationText(exchanges);

    expect(result).toBe(
      'User: First question\n\nAgent: First answer\n\n---\n\nUser: Second question\n\nAgent: Second answer'
    );
  });

  test('handles empty exchanges array', () => {
    const result = formatConversationText([]);
    expect(result).toBe('');
  });

  test('preserves newlines in messages', () => {
    const exchanges: ConversationExchange[] = [
      createExchange({
        userMessage: 'Line 1\nLine 2',
        assistantMessage: 'Response\nWith\nNewlines',
      }),
    ];

    const result = formatConversationText(exchanges);

    expect(result).toContain('Line 1\nLine 2');
    expect(result).toContain('Response\nWith\nNewlines');
  });

  test('handles special characters in messages', () => {
    const exchanges: ConversationExchange[] = [
      createExchange({
        userMessage: 'Special: <>&"\'`$',
        assistantMessage: 'Response with ${variable} and `backticks`',
      }),
    ];

    const result = formatConversationText(exchanges);

    expect(result).toContain('Special: <>&"\'`$');
    expect(result).toContain('${variable}');
    expect(result).toContain('`backticks`');
  });
});

describe('isTrivialConversation (via summarizeConversation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock that shouldn't be called for trivial conversations
    mockCompleteFn = vi.fn(async () => ({
      text: '<summary>This should not be called for trivial</summary>',
      usage: { input_tokens: 100, output_tokens: 50 },
    }));
  });

  test('returns trivial message for empty exchanges', async () => {
    const result = await summarizeConversation([]);

    expect(result).toBe('Trivial conversation with no substantive content.');
    expect(mockCompleteFn).not.toHaveBeenCalled();
  });

  test('returns trivial for single exchange with /exit command', async () => {
    const exchanges: ConversationExchange[] = [
      createExchange({
        userMessage: '/exit',
        assistantMessage: 'Goodbye!',
      }),
    ];

    const result = await summarizeConversation(exchanges);

    expect(result).toBe('Trivial conversation with no substantive content.');
    expect(mockCompleteFn).not.toHaveBeenCalled();
  });

  test('returns trivial for short exchange under 15 words', async () => {
    const exchanges: ConversationExchange[] = [
      createExchange({
        userMessage: 'Hi',
        assistantMessage: 'Hello!',
      }),
    ];

    const result = await summarizeConversation(exchanges);

    expect(result).toBe('Trivial conversation with no substantive content.');
    expect(mockCompleteFn).not.toHaveBeenCalled();
  });

  test('proceeds to summarization for exchange with 15+ words', async () => {
    mockCompleteFn = vi.fn(async () => ({
      text: '<summary>Real summary of conversation</summary>',
      usage: { input_tokens: 100, output_tokens: 50 },
    }));

    // Create exchange with exactly 15 words (threshold check)
    const exchanges: ConversationExchange[] = [
      createExchangeWithWordCount(20), // More than 15 words total
    ];

    const result = await summarizeConversation(exchanges);

    expect(result).toBe('Real summary of conversation');
    expect(mockCompleteFn).toHaveBeenCalled();
  });

  test('handles CJK characters in word count', async () => {
    // CJK characters are split differently for word counting
    const exchanges: ConversationExchange[] = [
      createExchange({
        userMessage: '日本語テストです', // Japanese - should trigger CJK splitting
        assistantMessage: '这是中文测试内容', // Chinese
      }),
    ];

    // Short CJK text should be trivial
    const result = await summarizeConversation(exchanges);
    expect(result).toBe('Trivial conversation with no substantive content.');
  });
});

describe('extractSummary (via summarizeConversation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('extracts content from <summary> tags', async () => {
    mockCompleteFn = vi.fn(async () => ({
      text: '<summary>Extracted summary content here</summary>',
      usage: { input_tokens: 100, output_tokens: 50 },
    }));

    const exchanges: ConversationExchange[] = [createExchangeWithWordCount(20)];
    const result = await summarizeConversation(exchanges);

    expect(result).toBe('Extracted summary content here');
  });

  test('uses fallback when no <summary> tags present', async () => {
    mockCompleteFn = vi.fn(async () => ({
      text: 'Plain text response without tags',
      usage: { input_tokens: 100, output_tokens: 50 },
    }));

    const exchanges: ConversationExchange[] = [createExchangeWithWordCount(20)];
    const result = await summarizeConversation(exchanges);

    expect(result).toBe('Plain text response without tags');
  });

  test('handles multiline content in <summary> tags', async () => {
    mockCompleteFn = vi.fn(async () => ({
      text: '<summary>Line 1\nLine 2\nLine 3</summary>',
      usage: { input_tokens: 100, output_tokens: 50 },
    }));

    const exchanges: ConversationExchange[] = [createExchangeWithWordCount(20)];
    const result = await summarizeConversation(exchanges);

    expect(result).toBe('Line 1\nLine 2\nLine 3');
  });

  test('trims whitespace from extracted summary', async () => {
    mockCompleteFn = vi.fn(async () => ({
      text: '<summary>  Trimmed content  </summary>',
      usage: { input_tokens: 100, output_tokens: 50 },
    }));

    const exchanges: ConversationExchange[] = [createExchangeWithWordCount(20)];
    const result = await summarizeConversation(exchanges);

    expect(result).toBe('Trimmed content');
  });
});

describe('summarizeConversation - short conversations (<=15 exchanges)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startTokenTracking();
  });

  test('summarizes single non-trivial exchange', async () => {
    mockCompleteFn = vi.fn(async () => ({
      text: '<summary>Summary of single exchange</summary>',
      usage: { input_tokens: 150, output_tokens: 30 },
    }));

    const exchanges: ConversationExchange[] = [createExchangeWithWordCount(20)];
    const result = await summarizeConversation(exchanges, 'test-session', 'test.jsonl');

    expect(result).toBe('Summary of single exchange');
    expect(mockCompleteFn).toHaveBeenCalledTimes(1);
  });

  test('summarizes multiple exchanges (up to 15)', async () => {
    mockCompleteFn = vi.fn(async () => ({
      text: '<summary>Summary of multiple exchanges</summary>',
      usage: { input_tokens: 500, output_tokens: 100 },
    }));

    const exchanges: ConversationExchange[] = Array.from({ length: 10 }, () =>
      createExchangeWithWordCount(20)
    );
    const result = await summarizeConversation(exchanges);

    expect(result).toBe('Summary of multiple exchanges');
    expect(mockCompleteFn).toHaveBeenCalledTimes(1);
  });

  test('handles LLM returning empty string', async () => {
    mockCompleteFn = vi.fn(async () => ({
      text: '',
      usage: { input_tokens: 100, output_tokens: 0 },
    }));

    const exchanges: ConversationExchange[] = [createExchangeWithWordCount(20)];
    const result = await summarizeConversation(exchanges);

    expect(result).toBe('[Not summarized - no LLM config found]');
  });

  test('includes conversation text in prompt', async () => {
    mockCompleteFn = vi.fn(async () => ({
      text: '<summary>Test summary</summary>',
      usage: { input_tokens: 100, output_tokens: 50 },
    }));

    // Create exchange with enough words to not be trivial
    const exchanges: ConversationExchange[] = [
      createExchange({
        userMessage: 'Custom user message content that is long enough to pass trivial check',
        assistantMessage: 'Custom assistant response with more words to ensure non trivial',
      }),
    ];

    await summarizeConversation(exchanges);

    const promptArg = mockCompleteFn.mock.calls[0][0];
    expect(promptArg).toContain('Custom user message content that is long enough to pass trivial check');
    expect(promptArg).toContain('Custom assistant response with more words to ensure non trivial');
  });
});

describe('summarizeConversation - long conversations (>15 exchanges)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startTokenTracking();
  });

  test('uses hierarchical summarization for 20 exchanges', async () => {
    let callCount = 0;
    mockCompleteFn = vi.fn(async () => {
      callCount++;
      // First call is for chunk, second is for synthesis
      if (callCount === 1) {
        return {
          text: '<summary>Chunk 1 summary</summary>',
          usage: { input_tokens: 200, output_tokens: 50 },
        };
      }
      return {
        text: '<summary>Final synthesized summary</summary>',
        usage: { input_tokens: 100, output_tokens: 30 },
      };
    });

    const exchanges: ConversationExchange[] = Array.from({ length: 20 }, () =>
      createExchangeWithWordCount(20)
    );
    const result = await summarizeConversation(exchanges);

    expect(result).toBe('Final synthesized summary');
    // Should be called once for chunk, once for synthesis
    expect(mockCompleteFn).toHaveBeenCalledTimes(2);
  });

  test('handles multiple chunks in hierarchical summarization', async () => {
    let callCount = 0;
    mockCompleteFn = vi.fn(async () => {
      callCount++;
      // First 2 calls for chunks, 3rd for synthesis
      if (callCount <= 2) {
        return {
          text: `<summary>Chunk ${callCount} summary</summary>`,
          usage: { input_tokens: 200, output_tokens: 50 },
        };
      }
      return {
        text: '<summary>Synthesized from multiple chunks</summary>',
        usage: { input_tokens: 150, output_tokens: 40 },
      };
    });

    // 50 exchanges = 2 chunks (32 + 18)
    const exchanges: ConversationExchange[] = Array.from({ length: 50 }, () =>
      createExchangeWithWordCount(20)
    );
    const result = await summarizeConversation(exchanges);

    expect(result).toBe('Synthesized from multiple chunks');
    expect(mockCompleteFn).toHaveBeenCalledTimes(3); // 2 chunks + 1 synthesis
  });

  test('falls back to chunk summaries when synthesis fails', async () => {
    let callCount = 0;
    mockCompleteFn = vi.fn(async () => {
      callCount++;
      // First call succeeds (chunk), second fails (synthesis returns empty)
      if (callCount === 1) {
        return {
          text: '<summary>Chunk summary A</summary>',
          usage: { input_tokens: 200, output_tokens: 50 },
        };
      }
      // Synthesis fails - returns empty
      return {
        text: '',
        usage: { input_tokens: 0, output_tokens: 0 },
      };
    });

    const exchanges: ConversationExchange[] = Array.from({ length: 20 }, () =>
      createExchangeWithWordCount(20)
    );
    const result = await summarizeConversation(exchanges);

    expect(result).toBe('Chunk summary A');
  });

  test('handles all chunks failing', async () => {
    mockCompleteFn = vi.fn(async () => ({
      text: '', // All calls fail
      usage: { input_tokens: 0, output_tokens: 0 },
    }));

    const exchanges: ConversationExchange[] = Array.from({ length: 20 }, () =>
      createExchangeWithWordCount(20)
    );
    const result = await summarizeConversation(exchanges);

    expect(result).toBe('[Not summarized - LLM config missing or all API calls failed]');
  });

  test('skips failed chunks and continues with successful ones', async () => {
    let callCount = 0;
    mockCompleteFn = vi.fn(async () => {
      callCount++;
      // Odd calls fail, even calls succeed
      if (callCount % 2 === 1) {
        return {
          text: '',
          usage: { input_tokens: 0, output_tokens: 0 },
        };
      }
      return {
        text: `<summary>Successful chunk ${callCount / 2}</summary>`,
        usage: { input_tokens: 200, output_tokens: 50 },
      };
    });

    // 64 exchanges = 2 chunks of 32
    const exchanges: ConversationExchange[] = Array.from({ length: 64 }, () =>
      createExchangeWithWordCount(20)
    );
    const result = await summarizeConversation(exchanges);

    // Should get synthesis of successful chunks
    expect(result).not.toContain('[Not summarized]');
  });
});

describe('token tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startTokenTracking();
  });

  afterEach(() => {
    startTokenTracking(); // Reset for other tests
  });

  test('startTokenTracking resets token usage', () => {
    trackTokenUsage({ input_tokens: 100, output_tokens: 50 });

    startTokenTracking();

    const usage = getCurrentRunTokenUsage();
    expect(usage.input_tokens).toBe(0);
    expect(usage.output_tokens).toBe(0);
  });

  test('trackTokenUsage accumulates tokens', () => {
    trackTokenUsage({ input_tokens: 100, output_tokens: 50 });
    trackTokenUsage({ input_tokens: 50, output_tokens: 25 });

    const usage = getCurrentRunTokenUsage();
    expect(usage.input_tokens).toBe(150);
    expect(usage.output_tokens).toBe(75);
  });

  test('trackTokenUsage handles cache tokens', () => {
    trackTokenUsage({
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 200,
      cache_creation_input_tokens: 300,
    });

    const usage = getCurrentRunTokenUsage();
    expect(usage.cache_read_input_tokens).toBe(200);
    expect(usage.cache_creation_input_tokens).toBe(300);
  });

  test('getCurrentRunTokenUsage returns sum of all tracked usage', () => {
    trackTokenUsage({ input_tokens: 100, output_tokens: 50 });
    trackTokenUsage({ input_tokens: 200, output_tokens: 100 });
    trackTokenUsage({
      input_tokens: 50,
      output_tokens: 25,
      cache_read_input_tokens: 100,
    });

    const usage = getCurrentRunTokenUsage();
    expect(usage.input_tokens).toBe(350);
    expect(usage.output_tokens).toBe(175);
    expect(usage.cache_read_input_tokens).toBe(100);
  });

  test('token tracking is used during summarization', async () => {
    mockCompleteFn = vi.fn(async () => ({
      text: '<summary>Test summary</summary>',
      usage: { input_tokens: 100, output_tokens: 50 },
    }));

    startTokenTracking();
    const exchanges: ConversationExchange[] = [createExchangeWithWordCount(20)];
    await summarizeConversation(exchanges);

    const usage = getCurrentRunTokenUsage();
    expect(usage.input_tokens).toBe(100);
    expect(usage.output_tokens).toBe(50);
  });
});

describe('error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startTokenTracking();
  });

  test('handles LLM API errors gracefully', async () => {
    mockCompleteFn = vi.fn(async () => {
      throw new Error('API Error');
    });

    const exchanges: ConversationExchange[] = [createExchangeWithWordCount(20)];
    const result = await summarizeConversation(exchanges);

    expect(result).toBe('[Not summarized - no LLM config found]');
  });

  test('handles synthesis errors by returning chunk summaries', async () => {
    let callCount = 0;
    mockCompleteFn = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          text: '<summary>Chunk summary</summary>',
          usage: { input_tokens: 200, output_tokens: 50 },
        };
      }
      throw new Error('Synthesis failed');
    });

    const exchanges: ConversationExchange[] = Array.from({ length: 20 }, () =>
      createExchangeWithWordCount(20)
    );
    const result = await summarizeConversation(exchanges);

    expect(result).toBe('Chunk summary');
  });
});
