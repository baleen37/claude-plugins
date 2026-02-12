/**
 * Tests for embeddings module
 *
 * These tests mock @huggingface/transformers to avoid loading the actual model
 * while verifying correct behavior of all exported functions.
 *
 * Note: Due to module-level state (embeddingPipeline singleton), each describe
 * block uses vi.resetModules() to ensure fresh module imports.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// Track calls to verify mock behavior
let mockPipelineCalls: Array<{ task: string; model: string; options: unknown }> = [];
let mockEmbeddingCalls: Array<{ text: string; options: unknown }> = [];

// Create a mock pipeline function that returns predictable output
const createMockPipeline = () => {
  return vi.fn(async (text: string, options: unknown) => {
    mockEmbeddingCalls.push({ text, options });
    // Return a Float32Array-like structure with 768 dimensions
    const data = new Float32Array(768);
    // Fill with predictable values based on text length for testing
    for (let i = 0; i < 768; i++) {
      data[i] = 0.001 * (i + 1);
    }
    return { data };
  });
};

let mockPipelineFn: ReturnType<typeof createMockPipeline>;

// Mock @huggingface/transformers module
// NOTE: vi.mock() is hoisted to the top of the file before any other code runs.
vi.mock('@huggingface/transformers', () => {
  // Create mock pipeline function within the factory
  const pipelineMock = vi.fn(async (task: string, model: string, options: unknown) => {
    mockPipelineCalls.push({ task, model, options });
    // Return the embedding function
    return mockPipelineFn;
  });

  return {
    pipeline: pipelineMock,
    env: { cacheDir: '' },
    FeatureExtractionPipeline: class {},
  };
});

describe('embeddings', () => {
  // We'll dynamically import the module in each test or describe block
  // to ensure fresh state after resetModules

  beforeEach(() => {
    // Reset all tracking arrays
    mockPipelineCalls = [];
    mockEmbeddingCalls = [];
    // Create a fresh mock pipeline function for each test
    mockPipelineFn = createMockPipeline();
    // Reset modules to clear the singleton state
    vi.resetModules();
  });

  describe('initEmbeddings()', () => {
    test('initializes the pipeline with correct parameters', async () => {
      const { initEmbeddings } = await import('./embeddings.js');

      await initEmbeddings();

      expect(mockPipelineCalls).toHaveLength(1);
      expect(mockPipelineCalls[0].task).toBe('feature-extraction');
      expect(mockPipelineCalls[0].model).toBe('onnx-community/embeddinggemma-300m-ONNX');
      expect(mockPipelineCalls[0].options).toEqual({ dtype: 'q4' });
    });

    test('sets cache directory', async () => {
      // Import the mocked env object
      const { env } = await import('@huggingface/transformers');
      const { initEmbeddings } = await import('./embeddings.js');

      await initEmbeddings();

      expect(env.cacheDir).toBe('./.cache');
    });

    test('reuses existing pipeline (singleton pattern)', async () => {
      const { initEmbeddings } = await import('./embeddings.js');

      // Call initEmbeddings twice
      await initEmbeddings();
      await initEmbeddings();

      // Pipeline should only be created once
      expect(mockPipelineCalls).toHaveLength(1);
    });

    test('logs loading messages', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { initEmbeddings } = await import('./embeddings.js');

      await initEmbeddings();

      expect(consoleSpy).toHaveBeenCalledWith('Loading embedding model (first run may take time)...');
      expect(consoleSpy).toHaveBeenCalledWith('Embedding model loaded');

      consoleSpy.mockRestore();
    });
  });

  describe('generateEmbedding()', () => {
    test('adds the required prefix to text', async () => {
      const { generateEmbedding } = await import('./embeddings.js');

      await generateEmbedding('test text');

      expect(mockEmbeddingCalls).toHaveLength(1);
      expect(mockEmbeddingCalls[0].text).toBe('title: none | text: test text');
    });

    test('truncates text exceeding 8000 characters', async () => {
      const { generateEmbedding } = await import('./embeddings.js');

      const longText = 'a'.repeat(10000);
      await generateEmbedding(longText);

      expect(mockEmbeddingCalls).toHaveLength(1);
      expect(mockEmbeddingCalls[0].text.length).toBe(8000);
    });

    test('does not truncate short text', async () => {
      const { generateEmbedding } = await import('./embeddings.js');

      const shortText = 'hello world';
      await generateEmbedding(shortText);

      expect(mockEmbeddingCalls).toHaveLength(1);
      expect(mockEmbeddingCalls[0].text).toBe('title: none | text: hello world');
    });

    test('truncates at exactly 8000 characters boundary', async () => {
      const { generateEmbedding } = await import('./embeddings.js');

      // Create text that with prefix is exactly 8000 chars
      const prefix = 'title: none | text: ';
      const textLength = 8000 - prefix.length;
      const exactText = 'a'.repeat(textLength);

      await generateEmbedding(exactText);

      expect(mockEmbeddingCalls[0].text.length).toBe(8000);
    });

    test('truncates text that exceeds by one character', async () => {
      const { generateEmbedding } = await import('./embeddings.js');

      // Create text that with prefix exceeds by 1 char
      const prefix = 'title: none | text: ';
      const textLength = 8000 - prefix.length + 1;
      const overText = 'a'.repeat(textLength);

      await generateEmbedding(overText);

      expect(mockEmbeddingCalls[0].text.length).toBe(8000);
    });

    test('returns an array of numbers with 768 dimensions', async () => {
      const { generateEmbedding } = await import('./embeddings.js');

      const result = await generateEmbedding('test');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(768);
      result.forEach((val) => {
        expect(typeof val).toBe('number');
      });
    });

    test('returns values from Float32Array conversion', async () => {
      const { generateEmbedding } = await import('./embeddings.js');

      const result = await generateEmbedding('test');

      // Check first and last values match our mock pattern
      expect(result[0]).toBeCloseTo(0.001, 4);
      expect(result[767]).toBeCloseTo(0.768, 3);
    });

    test('calls initEmbeddings if pipeline not initialized', async () => {
      const { generateEmbedding } = await import('./embeddings.js');

      // generateEmbedding should auto-initialize
      await generateEmbedding('test');

      // Pipeline should be created (via initEmbeddings)
      expect(mockPipelineCalls).toHaveLength(1);
    });

    test('reuses existing pipeline when already initialized', async () => {
      const { initEmbeddings, generateEmbedding } = await import('./embeddings.js');

      // Initialize first
      await initEmbeddings();
      mockPipelineCalls = []; // Reset tracking

      // Now generate embedding
      await generateEmbedding('test');

      // Pipeline should NOT be created again
      expect(mockPipelineCalls).toHaveLength(0);
    });

    test('passes pooling and normalize options to pipeline', async () => {
      const { generateEmbedding } = await import('./embeddings.js');

      await generateEmbedding('test');

      expect(mockEmbeddingCalls[0].options).toEqual({
        pooling: 'mean',
        normalize: true,
      });
    });

    test('handles empty text', async () => {
      const { generateEmbedding } = await import('./embeddings.js');

      const result = await generateEmbedding('');

      expect(mockEmbeddingCalls[0].text).toBe('title: none | text: ');
      expect(result).toHaveLength(768);
    });

    test('preserves special characters in text', async () => {
      const { generateEmbedding } = await import('./embeddings.js');

      const specialText = 'Test with "quotes" and \'apostrophes\' & <html>';
      await generateEmbedding(specialText);

      expect(mockEmbeddingCalls[0].text).toBe(`title: none | text: ${specialText}`);
    });

    test('preserves newlines in text', async () => {
      const { generateEmbedding } = await import('./embeddings.js');

      const multilineText = 'Line 1\nLine 2\nLine 3';
      await generateEmbedding(multilineText);

      expect(mockEmbeddingCalls[0].text).toBe('title: none | text: Line 1\nLine 2\nLine 3');
    });
  });

  describe('generateExchangeEmbedding()', () => {
    test('combines user and assistant messages with labels', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      await generateExchangeEmbedding('How do I test?', 'Use vitest');

      // Check the embedding was called with formatted text
      expect(mockEmbeddingCalls).toHaveLength(1);
      expect(mockEmbeddingCalls[0].text).toBe(
        'title: none | text: User: How do I test?\n\nAssistant: Use vitest'
      );
    });

    test('includes tools section when tools are provided', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      await generateExchangeEmbedding('Search files', 'Found 3 files', ['Grep', 'Glob']);

      expect(mockEmbeddingCalls[0].text).toBe(
        'title: none | text: User: Search files\n\nAssistant: Found 3 files\n\nTools: Grep, Glob'
      );
    });

    test('excludes tools section when no tools provided', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      await generateExchangeEmbedding('Hello', 'Hi', []);

      expect(mockEmbeddingCalls[0].text).toBe(
        'title: none | text: User: Hello\n\nAssistant: Hi'
      );
    });

    test('excludes tools section when tools is undefined', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      await generateExchangeEmbedding('Hello', 'Hi');

      expect(mockEmbeddingCalls[0].text).toBe(
        'title: none | text: User: Hello\n\nAssistant: Hi'
      );
      expect(mockEmbeddingCalls[0].text).not.toContain('Tools:');
    });

    test('formats single tool correctly', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      await generateExchangeEmbedding('Read file', 'Done', ['Read']);

      expect(mockEmbeddingCalls[0].text).toContain('Tools: Read');
    });

    test('formats multiple tools with comma separation', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      await generateExchangeEmbedding('Search', 'Done', ['Read', 'Write', 'Bash', 'Grep']);

      expect(mockEmbeddingCalls[0].text).toContain('Tools: Read, Write, Bash, Grep');
    });

    test('returns embedding array from generateEmbedding', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      const result = await generateExchangeEmbedding('Q', 'A');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(768);
    });

    test('handles empty user message', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      await generateExchangeEmbedding('', 'Response');

      expect(mockEmbeddingCalls[0].text).toBe(
        'title: none | text: User: \n\nAssistant: Response'
      );
    });

    test('handles empty assistant message', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      await generateExchangeEmbedding('Question', '');

      expect(mockEmbeddingCalls[0].text).toBe(
        'title: none | text: User: Question\n\nAssistant: '
      );
    });

    test('preserves newlines within messages', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      await generateExchangeEmbedding('Line 1\nLine 2', 'Response 1\nResponse 2');

      expect(mockEmbeddingCalls[0].text).toContain('User: Line 1\nLine 2');
      expect(mockEmbeddingCalls[0].text).toContain('Assistant: Response 1\nResponse 2');
    });

    test('handles special characters in messages', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      await generateExchangeEmbedding(
        'Test with "quotes" and \'apostrophes\'',
        'Response with <html> & entities',
        ['Read', 'Write']
      );

      const text = mockEmbeddingCalls[0].text;
      expect(text).toContain('"quotes"');
      expect(text).toContain('\'apostrophes\'');
      expect(text).toContain('<html>');
      expect(text).toContain('&');
    });

    test('truncates combined text if too long', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      const longUser = 'a'.repeat(4000);
      const longAssistant = 'b'.repeat(4000);

      await generateExchangeEmbedding(longUser, longAssistant);

      // Combined text should be truncated to 8000 chars
      expect(mockEmbeddingCalls[0].text.length).toBe(8000);
    });

    test('calls generateEmbedding with correctly formatted text', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      // The function should format the text and pass to generateEmbedding
      // which adds the prefix
      await generateExchangeEmbedding('User question', 'Assistant answer', ['Tool1', 'Tool2']);

      const expected = 'title: none | text: User: User question\n\nAssistant: Assistant answer\n\nTools: Tool1, Tool2';
      expect(mockEmbeddingCalls[0].text).toBe(expected);
    });
  });

  describe('integration scenarios', () => {
    test('full workflow: init then generate multiple embeddings', async () => {
      const { initEmbeddings, generateEmbedding } = await import('./embeddings.js');

      await initEmbeddings();
      await generateEmbedding('first text');
      await generateEmbedding('second text');
      await generateEmbedding('third text');

      // Pipeline should only be initialized once
      expect(mockPipelineCalls).toHaveLength(1);
      // But embedding should be called 3 times
      expect(mockEmbeddingCalls).toHaveLength(3);
    });

    test('generateEmbedding auto-initializes on first call', async () => {
      const { generateEmbedding } = await import('./embeddings.js');

      // Without explicit init, should still work
      const result = await generateEmbedding('auto init test');

      expect(mockPipelineCalls).toHaveLength(1);
      expect(result).toHaveLength(768);
    });

    test('generateExchangeEmbedding auto-initializes', async () => {
      const { generateExchangeEmbedding } = await import('./embeddings.js');

      // Without explicit init, should still work
      const result = await generateExchangeEmbedding('user msg', 'assistant msg');

      expect(mockPipelineCalls).toHaveLength(1);
      expect(result).toHaveLength(768);
    });
  });
});
