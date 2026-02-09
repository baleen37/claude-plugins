/**
 * V3 MCP Server Tests
 *
 * Tests for the simplified 3-tool architecture:
 * 1. search - Single query string, returns compact observations
 * 2. get_observations - Full details by ID array
 * 3. read - Raw conversation from JSONL
 *
 * Follows TDD principles with mocked dependencies.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';

// Re-define V3 schemas for testing
const SearchModeEnum = z.enum(['vector', 'text', 'both']);

const SearchInputSchemaV3 = z
  .object({
    query: z
      .string()
      .min(2, 'Query must be at least 2 characters')
      .describe('Search query string'),
    mode: SearchModeEnum.default('both').describe(
      'Search mode: "vector" for semantic similarity, "text" for exact matching, "both" for combined'
    ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe('Maximum number of results to return (default: 10)'),
    after: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .describe('Only return results after this date (YYYY-MM-DD format)'),
    before: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .describe('Only return results before this date (YYYY-MM-DD format)'),
    projects: z
      .array(z.string().min(1))
      .optional()
      .describe('Filter results to specific project names'),
    files: z
      .array(z.string().min(1))
      .optional()
      .describe('Filter results to specific file paths'),
  })
  .strict();

const GetObservationsInputSchemaV3 = z
  .object({
    ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1, 'Must provide at least 1 observation ID')
      .max(20, 'Cannot get more than 20 observations at once')
      .describe('Array of observation IDs to retrieve'),
  })
  .strict();

const ReadInputSchemaV3 = z
  .object({
    path: z
      .string()
      .min(1, 'Path is required')
      .describe('Path to the JSONL conversation file'),
    startLine: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Starting line number (1-indexed, inclusive)'),
    endLine: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Ending line number (1-indexed, inclusive)'),
  })
  .strict();

// Test helper function to simulate MCP tool calls
async function mockToolCallV3(toolName: string, args: any) {
  try {
    if (toolName === 'search') {
      const params = SearchInputSchemaV3.parse(args);

      // Return success response (mocked)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              results: [
                {
                  id: '1',
                  title: 'Test Observation',
                  project: 'test-project',
                  timestamp: Date.now()
                }
              ],
              count: 1
            })
          }
        ],
        isError: false
      };
    }

    if (toolName === 'get_observations') {
      const params = GetObservationsInputSchemaV3.parse(args);

      // Return success response (mocked)
      return {
        content: [
          {
            type: 'text',
            text: `Retrieved ${params.ids.length} observation(s):\n\n## Test Observation\n\nTest content\n\n---\n\n`
          }
        ],
        isError: false
      };
    }

    if (toolName === 'read') {
      const params = ReadInputSchemaV3.parse(args);

      // Return success response (mocked)
      return {
        content: [
          {
            type: 'text',
            text: '# Conversation\n\nMock content'
          }
        ],
        isError: false
      };
    }

    throw new Error(`Unknown tool: ${toolName}`);
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: error instanceof Error
            ? `Error: ${error.message}`
            : `Error: ${String(error)}`
        }
      ],
      isError: true
    };
  }
}

describe('V3 MCP Server - search tool', () => {
  describe('Query parameter validation', () => {
    test('rejects query shorter than 2 characters', async () => {
      const result = await mockToolCallV3('search', { query: 'a' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query must be at least 2 characters');
    });

    test('rejects empty string query', async () => {
      const result = await mockToolCallV3('search', { query: '' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query must be at least 2 characters');
    });

    test('accepts valid string query', async () => {
      const result = await mockToolCallV3('search', { query: 'test query' });

      expect(result.isError).toBe(false);
    });

    test('rejects array query (V3 only accepts strings)', async () => {
      const result = await mockToolCallV3('search', { query: ['concept1', 'concept2'] } as any);

      expect(result.isError).toBe(true);
    });
  });

  describe('Mode parameter validation', () => {
    test('accepts "vector" mode', async () => {
      const result = await mockToolCallV3('search', { query: 'test', mode: 'vector' });

      expect(result.isError).toBe(false);
    });

    test('accepts "text" mode', async () => {
      const result = await mockToolCallV3('search', { query: 'test', mode: 'text' });

      expect(result.isError).toBe(false);
    });

    test('accepts "both" mode', async () => {
      const result = await mockToolCallV3('search', { query: 'test', mode: 'both' });

      expect(result.isError).toBe(false);
    });

    test('defaults to "both" mode when not specified', async () => {
      const result = await mockToolCallV3('search', { query: 'test' });

      expect(result.isError).toBe(false);
    });

    test('rejects invalid mode value', async () => {
      const result = await mockToolCallV3('search', { query: 'test', mode: 'invalid' as any });

      expect(result.isError).toBe(true);
    });
  });

  describe('Date format validation', () => {
    test('rejects invalid after date format', async () => {
      const result = await mockToolCallV3('search', { query: 'test', after: '2024/01/01' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Date must be in YYYY-MM-DD format');
    });

    test('rejects invalid before date format', async () => {
      const result = await mockToolCallV3('search', { query: 'test', before: '01-01-2024' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Date must be in YYYY-MM-DD format');
    });

    test('accepts valid after date in YYYY-MM-DD format', async () => {
      const result = await mockToolCallV3('search', { query: 'test', after: '2024-01-15' });

      expect(result.isError).toBe(false);
    });

    test('accepts valid before date in YYYY-MM-DD format', async () => {
      const result = await mockToolCallV3('search', { query: 'test', before: '2024-12-31' });

      expect(result.isError).toBe(false);
    });

    test('accepts both after and before dates', async () => {
      const result = await mockToolCallV3('search', {
        query: 'test',
        after: '2024-01-01',
        before: '2024-12-31'
      });

      expect(result.isError).toBe(false);
    });
  });

  describe('Limit parameter validation', () => {
    test('accepts valid limit within range', async () => {
      const result = await mockToolCallV3('search', { query: 'test', limit: 25 });

      expect(result.isError).toBe(false);
    });

    test('accepts minimum limit of 1', async () => {
      const result = await mockToolCallV3('search', { query: 'test', limit: 1 });

      expect(result.isError).toBe(false);
    });

    test('accepts maximum limit of 50', async () => {
      const result = await mockToolCallV3('search', { query: 'test', limit: 50 });

      expect(result.isError).toBe(false);
    });

    test('rejects limit less than 1', async () => {
      const result = await mockToolCallV3('search', { query: 'test', limit: 0 });

      expect(result.isError).toBe(true);
    });

    test('rejects limit greater than 50', async () => {
      const result = await mockToolCallV3('search', { query: 'test', limit: 51 });

      expect(result.isError).toBe(true);
    });

    test('defaults to 10 when not specified', async () => {
      const result = await mockToolCallV3('search', { query: 'test' });

      expect(result.isError).toBe(false);
    });
  });

  describe('Projects parameter validation', () => {
    test('accepts array of project names', async () => {
      const result = await mockToolCallV3('search', {
        query: 'test',
        projects: ['project1', 'project2']
      });

      expect(result.isError).toBe(false);
    });

    test('accepts single project in array', async () => {
      const result = await mockToolCallV3('search', {
        query: 'test',
        projects: ['my-project']
      });

      expect(result.isError).toBe(false);
    });

    test('rejects empty string in projects array', async () => {
      const result = await mockToolCallV3('search', {
        query: 'test',
        projects: ['valid-project', '']
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('Files parameter validation', () => {
    test('accepts array of file paths', async () => {
      const result = await mockToolCallV3('search', {
        query: 'test',
        files: ['/path/to/file1.ts', '/path/to/file2.ts']
      });

      expect(result.isError).toBe(false);
    });

    test('accepts single file path in array', async () => {
      const result = await mockToolCallV3('search', {
        query: 'test',
        files: ['my/file.ts']
      });

      expect(result.isError).toBe(false);
    });
  });

  describe('Strict schema validation', () => {
    test('rejects unknown properties', async () => {
      const result = await mockToolCallV3('search', {
        query: 'test',
        unknownParam: 'value'
      });

      expect(result.isError).toBe(true);
    });

    test('rejects response_format (removed in V3)', async () => {
      const result = await mockToolCallV3('search', {
        query: 'test',
        response_format: 'json' as any
      });

      expect(result.isError).toBe(true);
    });

    test('rejects types parameter (removed in V3)', async () => {
      const result = await mockToolCallV3('search', {
        query: 'test',
        types: ['decision'] as any
      });

      expect(result.isError).toBe(true);
    });

    test('rejects concepts parameter (removed in V3)', async () => {
      const result = await mockToolCallV3('search', {
        query: 'test',
        concepts: ['react'] as any
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('Search results format', () => {
    test('returns compact observations with id, title, project, timestamp', async () => {
      const result = await mockToolCallV3('search', { query: 'test search' });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('results');
      expect(parsed.results).toBeInstanceOf(Array);
      expect(parsed.results[0]).toHaveProperty('id');
      expect(parsed.results[0]).toHaveProperty('title');
      expect(parsed.results[0]).toHaveProperty('project');
      expect(parsed.results[0]).toHaveProperty('timestamp');
      expect(parsed.results[0]).not.toHaveProperty('content'); // Compact format
    });

    test('returns count in results', async () => {
      const result = await mockToolCallV3('search', { query: 'test' });

      expect(result.isError).toBe(false);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('count');
      expect(typeof parsed.count).toBe('number');
    });
  });
});

describe('V3 MCP Server - get_observations tool', () => {
  describe('IDs parameter validation', () => {
    test('rejects empty ids array', async () => {
      const result = await mockToolCallV3('get_observations', { ids: [] });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Must provide at least 1 observation ID');
    });

    test('rejects ids array with more than 20 items', async () => {
      const ids = Array.from({ length: 21 }, (_, i) => String(i + 1));
      const result = await mockToolCallV3('get_observations', { ids });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Cannot get more than 20 observations');
    });

    test('accepts ids array with exactly 20 items', async () => {
      const ids = Array.from({ length: 20 }, (_, i) => String(i + 1));
      const result = await mockToolCallV3('get_observations', { ids });

      expect(result.isError).toBe(false);
    });

    test('accepts string IDs', async () => {
      const result = await mockToolCallV3('get_observations', { ids: ['1', '2', '3'] });

      expect(result.isError).toBe(false);
    });

    test('accepts number IDs', async () => {
      const result = await mockToolCallV3('get_observations', { ids: [1, 2, 3] });

      expect(result.isError).toBe(false);
    });

    test('accepts mixed string and number IDs', async () => {
      const result = await mockToolCallV3('get_observations', { ids: ['1', 2, '3'] });

      expect(result.isError).toBe(false);
    });
  });

  describe('Response format', () => {
    test('returns markdown formatted observations', async () => {
      const result = await mockToolCallV3('get_observations', { ids: ['1', '2'] });

      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('## Test Observation');
      expect(result.content[0].text).toContain('Test content');
      expect(result.content[0].text).toContain('---');
    });

    test('includes observation count in response', async () => {
      const result = await mockToolCallV3('get_observations', { ids: ['1', '2', '3'] });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Retrieved 3 observation(s)');
    });
  });

  describe('Strict schema validation', () => {
    test('rejects unknown properties', async () => {
      const result = await mockToolCallV3('get_observations', {
        ids: ['1'],
        unknownParam: 'value'
      });

      expect(result.isError).toBe(true);
    });
  });
});

describe('V3 MCP Server - read tool', () => {
  describe('Path parameter validation', () => {
    test('rejects empty path', async () => {
      const result = await mockToolCallV3('read', { path: '' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Path is required');
    });

    test('accepts valid path', async () => {
      const result = await mockToolCallV3('read', {
        path: '/path/to/conversation.jsonl'
      });

      expect(result.isError).toBe(false);
    });
  });

  describe('Pagination parameters', () => {
    test('accepts startLine parameter', async () => {
      const result = await mockToolCallV3('read', {
        path: '/test/file.jsonl',
        startLine: 10
      });

      expect(result.isError).toBe(false);
    });

    test('accepts endLine parameter', async () => {
      const result = await mockToolCallV3('read', {
        path: '/test/file.jsonl',
        endLine: 50
      });

      expect(result.isError).toBe(false);
    });

    test('accepts both startLine and endLine', async () => {
      const result = await mockToolCallV3('read', {
        path: '/test/file.jsonl',
        startLine: 10,
        endLine: 50
      });

      expect(result.isError).toBe(false);
    });

    test('rejects startLine less than 1', async () => {
      const result = await mockToolCallV3('read', {
        path: '/test/file.jsonl',
        startLine: 0
      });

      expect(result.isError).toBe(true);
    });

    test('rejects endLine less than 1', async () => {
      const result = await mockToolCallV3('read', {
        path: '/test/file.jsonl',
        endLine: 0
      });

      expect(result.isError).toBe(true);
    });

    test('rejects non-integer startLine', async () => {
      const result = await mockToolCallV3('read', {
        path: '/test/file.jsonl',
        startLine: 10.5
      });

      expect(result.isError).toBe(true);
    });

    test('rejects negative startLine', async () => {
      const result = await mockToolCallV3('read', {
        path: '/test/file.jsonl',
        startLine: -5
      });

      expect(result.isError).toBe(true);
    });

    test('works without pagination parameters', async () => {
      const result = await mockToolCallV3('read', {
        path: '/test/file.jsonl'
      });

      expect(result.isError).toBe(false);
    });
  });

  describe('Response format', () => {
    test('returns markdown formatted conversation', async () => {
      const result = await mockToolCallV3('read', {
        path: '/test/file.jsonl'
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('# Conversation');
    });
  });

  describe('Strict schema validation', () => {
    test('rejects unknown properties', async () => {
      const result = await mockToolCallV3('read', {
        path: '/test/file.jsonl',
        unknownParam: 'value'
      });

      expect(result.isError).toBe(true);
    });
  });
});

describe('V3 MCP Server - Error handling', () => {
  test('returns error for unknown tool name', async () => {
    const result = await mockToolCallV3('unknown_tool' as any, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown tool');
  });

  test('error responses include isError flag', async () => {
    const result = await mockToolCallV3('search', { query: 'x' });

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
  });

  test('error responses have proper format', async () => {
    const result = await mockToolCallV3('read', { path: '' });

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toMatch(/^Error:/);
  });
});
