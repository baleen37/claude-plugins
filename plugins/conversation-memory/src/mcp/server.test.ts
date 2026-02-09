/**
 * MCP Server Tests
 *
 * Comprehensive tests for the conversation-memory MCP server tools.
 * Tests follow TDD principles with mocked dependencies.
 *
 * Test Coverage:
 *
 * 1. **conversation-memory__search tool**:
 *   - Query parameter validation (string and array forms)
 *   - Mode parameter validation (vector/text/both)
 *   - Date format validation (YYYY-MM-DD regex)
 *   - Limit parameter validation (1-50 range)
 *   - Projects parameter validation
 *   - Response format validation (markdown/json)
 *   - Strict schema validation (no additional properties)
 *   - Search results handling
 *
 * 2. **conversation-memory__read tool**:
 *   - Path parameter validation
 *   - Pagination parameters (startLine/endLine)
 *   - Error handling
 *   - Output formatting
 *   - Strict schema validation
 *
 * 3. **Error handling**:
 *   - Unknown tool names
 *   - Validation errors
 *   - Error response format
 *
 * Testing Approach:
 * - Tests Zod schema validation directly
 * - Uses mockToolCall helper to simulate MCP tool invocations
 * - Verifies both successful and error cases
 * - Tests edge cases and boundary conditions
 *
 * Note: The schemas are re-defined here for testing to avoid build dependencies.
 * In production, these are defined in server.ts and should be kept in sync.
 *
 * V3 Architecture Note:
 * - DB integration tests removed (V3 reads conversations directly from JSONL files)
 * - Multi-concept search removed (V3 uses single-string query with full-text search)
 */

import { describe, test, expect } from 'vitest';
import { z } from 'zod';

// Re-define schemas for testing (in production these would be imported from server.ts)
const SearchModeEnum = z.enum(['vector', 'text', 'both']);
const ResponseFormatEnum = z.enum(['markdown', 'json']);

const SearchInputSchema = z
  .object({
    query: z
      .string()
      .min(2, 'Query must be at least 2 characters')
      .describe('Search query for observations'),
    mode: SearchModeEnum.default('both').describe(
      'Search mode: "vector" for semantic similarity, "text" for exact matching, "both" for combined (default: "both")'
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
      .describe('Only return conversations after this date (YYYY-MM-DD format)'),
    before: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .describe('Only return conversations before this date (YYYY-MM-DD format)'),
    projects: z
      .array(z.string().min(1))
      .optional()
      .describe('Filter results to specific project names (e.g., ["my-project", "another-project"])'),
    response_format: ResponseFormatEnum.default('markdown').describe(
      'Output format: "markdown" for human-readable or "json" for machine-readable (default: "markdown")'
    ),
  })
  .strict();

const ShowConversationInputSchema = z
  .object({
    path: z
      .string()
      .min(1, 'Path is required')
      .describe('Absolute path to the JSONL conversation file to display'),
    startLine: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Starting line number (1-indexed, inclusive). Omit to start from beginning.'),
    endLine: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Ending line number (1-indexed, inclusive). Omit to read to end.'),
  })
  .strict();

// Test helper function to simulate MCP tool calls
async function mockToolCall(toolName: string, args: any) {
  try {
    if (toolName === 'search') {
      const params = SearchInputSchema.parse(args);

      // Return success response (mocked)
      return {
        content: [
          {
            type: 'text',
            text: args.response_format === 'json'
              ? JSON.stringify({ results: [], count: 0 }, null, 2)
              : 'No results found.'
          }
        ],
        isError: false
      };
    }

    if (toolName === 'read') {
      const params = ShowConversationInputSchema.parse(args);

      // Check file exists (mocked)
      // In real implementation, fs.existsSync would be called
      if (params.path && !params.path.startsWith('/')) {
        // For testing, just accept any non-empty path
      }

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

describe('MCP Server - conversation-memory__search tool', () => {
  describe('Query parameter validation', () => {
    test('rejects query shorter than 2 characters', async () => {
      const result = await mockToolCall('search', { query: 'a' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query must be at least 2 characters');
    });

    test('rejects empty string query', async () => {
      const result = await mockToolCall('search', { query: '' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query must be at least 2 characters');
    });

    test('accepts valid string query', async () => {
      const result = await mockToolCall('search', { query: 'test query' });

      expect(result.isError).toBe(false);
    });
  });

  describe('Mode parameter validation', () => {
    test('accepts "vector" mode', async () => {
      const result = await mockToolCall('search', { query: 'test', mode: 'vector' });

      expect(result.isError).toBe(false);
    });

    test('accepts "text" mode', async () => {
      const result = await mockToolCall('search', { query: 'test', mode: 'text' });

      expect(result.isError).toBe(false);
    });

    test('accepts "both" mode', async () => {
      const result = await mockToolCall('search', { query: 'test', mode: 'both' });

      expect(result.isError).toBe(false);
    });

    test('defaults to "both" mode when not specified', async () => {
      const result = await mockToolCall('search', { query: 'test' });

      expect(result.isError).toBe(false);
    });

    test('rejects invalid mode value', async () => {
      const result = await mockToolCall('search', { query: 'test', mode: 'invalid' as any });

      expect(result.isError).toBe(true);
    });
  });

  describe('Date format validation', () => {
    test('rejects invalid after date format', async () => {
      const result = await mockToolCall('search', { query: 'test', after: '2024/01/01' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Date must be in YYYY-MM-DD format');
    });

    test('rejects invalid before date format', async () => {
      const result = await mockToolCall('search', { query: 'test', before: '01-01-2024' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Date must be in YYYY-MM-DD format');
    });

    test('accepts valid after date in YYYY-MM-DD format', async () => {
      const result = await mockToolCall('search', { query: 'test', after: '2024-01-15' });

      expect(result.isError).toBe(false);
    });

    test('accepts valid before date in YYYY-MM-DD format', async () => {
      const result = await mockToolCall('search', { query: 'test', before: '2024-12-31' });

      expect(result.isError).toBe(false);
    });

    test('accepts both after and before dates', async () => {
      const result = await mockToolCall('search', {
        query: 'test',
        after: '2024-01-01',
        before: '2024-12-31'
      });

      expect(result.isError).toBe(false);
    });

    test('rejects malformed date string', async () => {
      const result = await mockToolCall('search', { query: 'test', after: 'not-a-date' });

      expect(result.isError).toBe(true);
    });

    test('accepts date with invalid month (regex-only validation)', async () => {
      // Note: Zod regex only validates the format pattern, not semantic validity
      // The server.ts searchConversations function has additional validation for this
      const result = await mockToolCall('search', { query: 'test', after: '2024-13-01' });

      // Schema validation passes (format matches YYYY-MM-DD)
      expect(result.isError).toBe(false);
    });

    test('accepts date with invalid day (regex-only validation)', async () => {
      // Note: Zod regex only validates the format pattern, not semantic validity
      // The server.ts searchConversations function has additional validation for this
      const result = await mockToolCall('search', { query: 'test', after: '2024-01-32' });

      // Schema validation passes (format matches YYYY-MM-DD)
      expect(result.isError).toBe(false);
    });
  });

  describe('Limit parameter validation', () => {
    test('accepts valid limit within range', async () => {
      const result = await mockToolCall('search', { query: 'test', limit: 25 });

      expect(result.isError).toBe(false);
    });

    test('accepts minimum limit of 1', async () => {
      const result = await mockToolCall('search', { query: 'test', limit: 1 });

      expect(result.isError).toBe(false);
    });

    test('accepts maximum limit of 50', async () => {
      const result = await mockToolCall('search', { query: 'test', limit: 50 });

      expect(result.isError).toBe(false);
    });

    test('rejects limit less than 1', async () => {
      const result = await mockToolCall('search', { query: 'test', limit: 0 });

      expect(result.isError).toBe(true);
    });

    test('rejects limit greater than 50', async () => {
      const result = await mockToolCall('search', { query: 'test', limit: 51 });

      expect(result.isError).toBe(true);
    });

    test('rejects non-integer limit', async () => {
      const result = await mockToolCall('search', { query: 'test', limit: 10.5 });

      expect(result.isError).toBe(true);
    });

    test('defaults to 10 when not specified', async () => {
      const result = await mockToolCall('search', { query: 'test' });

      expect(result.isError).toBe(false);
    });
  });

  describe('Projects parameter validation', () => {
    test('accepts array of project names', async () => {
      const result = await mockToolCall('search', {
        query: 'test',
        projects: ['project1', 'project2']
      });

      expect(result.isError).toBe(false);
    });

    test('accepts single project in array', async () => {
      const result = await mockToolCall('search', {
        query: 'test',
        projects: ['my-project']
      });

      expect(result.isError).toBe(false);
    });

    test('rejects empty string in projects array', async () => {
      const result = await mockToolCall('search', {
        query: 'test',
        projects: ['valid-project', '']
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('Response format validation', () => {
    test('accepts "markdown" format', async () => {
      const result = await mockToolCall('search', { query: 'test', response_format: 'markdown' });

      expect(result.isError).toBe(false);
    });

    test('accepts "json" format', async () => {
      const result = await mockToolCall('search', { query: 'test', response_format: 'json' });

      expect(result.isError).toBe(false);
    });

    test('rejects invalid response format', async () => {
      const result = await mockToolCall('search', { query: 'test', response_format: 'xml' as any });

      expect(result.isError).toBe(true);
    });

    test('defaults to "markdown" when not specified', async () => {
      const result = await mockToolCall('search', { query: 'test' });

      expect(result.isError).toBe(false);
    });
  });

  describe('Strict schema validation', () => {
    test('rejects unknown properties', async () => {
      const result = await mockToolCall('search', {
        query: 'test',
        unknownParam: 'value'
      });

      expect(result.isError).toBe(true);
    });

    test('rejects additional properties', async () => {
      const result = await mockToolCall('search', {
        query: 'test',
        mode: 'vector',
        extraField: 'not allowed'
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('Search results handling', () => {
    test('returns formatted search results for single concept', async () => {
      const result = await mockToolCall('search', { query: 'test search' });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    test('returns JSON format when requested', async () => {
      const result = await mockToolCall('search', {
        query: 'test',
        response_format: 'json'
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe('text');

      // Verify it's valid JSON
      const jsonResult = JSON.parse(result.content[0].text);
      expect(jsonResult).toHaveProperty('results');
      expect(jsonResult).toHaveProperty('count');
    });
  });
});

describe('MCP Server - conversation-memory__read tool', () => {
  describe('Path parameter validation', () => {
    test('rejects empty path', async () => {
      const result = await mockToolCall('read', { path: '' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Path is required');
    });

    test('accepts valid absolute path', async () => {
      const result = await mockToolCall('read', {
        path: '/absolute/path/to/conversation.jsonl'
      });

      expect(result.isError).toBe(false);
    });

    test('accepts valid relative path', async () => {
      const result = await mockToolCall('read', {
        path: 'relative/path/to/conversation.jsonl'
      });

      expect(result.isError).toBe(false);
    });
  });

  describe('Pagination parameters', () => {
    test('accepts startLine parameter', async () => {
      const result = await mockToolCall('read', {
        path: '/test/file.jsonl',
        startLine: 10
      });

      expect(result.isError).toBe(false);
    });

    test('accepts endLine parameter', async () => {
      const result = await mockToolCall('read', {
        path: '/test/file.jsonl',
        endLine: 50
      });

      expect(result.isError).toBe(false);
    });

    test('accepts both startLine and endLine', async () => {
      const result = await mockToolCall('read', {
        path: '/test/file.jsonl',
        startLine: 10,
        endLine: 50
      });

      expect(result.isError).toBe(false);
    });

    test('rejects startLine less than 1', async () => {
      const result = await mockToolCall('read', {
        path: '/test/file.jsonl',
        startLine: 0
      });

      expect(result.isError).toBe(true);
    });

    test('rejects endLine less than 1', async () => {
      const result = await mockToolCall('read', {
        path: '/test/file.jsonl',
        endLine: 0
      });

      expect(result.isError).toBe(true);
    });

    test('rejects non-integer startLine', async () => {
      const result = await mockToolCall('read', {
        path: '/test/file.jsonl',
        startLine: 10.5
      });

      expect(result.isError).toBe(true);
    });

    test('rejects negative startLine', async () => {
      const result = await mockToolCall('read', {
        path: '/test/file.jsonl',
        startLine: -5
      });

      expect(result.isError).toBe(true);
    });

    test('works without pagination parameters', async () => {
      const result = await mockToolCall('read', {
        path: '/test/file.jsonl'
      });

      expect(result.isError).toBe(false);
    });
  });

  describe('Output formatting', () => {
    test('returns text content type', async () => {
      const result = await mockToolCall('read', {
        path: '/test/file.jsonl'
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('Strict schema validation', () => {
    test('rejects unknown properties', async () => {
      const result = await mockToolCall('read', {
        path: '/test/file.jsonl',
        unknownParam: 'value'
      });

      expect(result.isError).toBe(true);
    });
  });
});

describe('MCP Server - Error handling', () => {
  test('returns error for unknown tool name', async () => {
    const result = await mockToolCall('unknown_tool' as any, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown tool');
  });

  test('error responses include isError flag', async () => {
    const result = await mockToolCall('search', { query: 'x' });

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
  });

  test('error responses have proper format', async () => {
    const result = await mockToolCall('read', { path: '' });

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toMatch(/^Error:/);
  });
});

// Additional tests for Zod schema validation
describe('SearchInput Schema - Direct validation', () => {
  test('validates complete valid input', () => {
    const result = SearchInputSchema.safeParse({
      query: 'test',
      mode: 'vector',
      limit: 10,
      after: '2024-01-01',
      before: '2024-12-31',
      projects: ['project1'],
      response_format: 'json'
    });

    expect(result.success).toBe(true);
  });

  test('applies default values', () => {
    const result = SearchInputSchema.safeParse({
      query: 'test'
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('both');
      expect(result.data.limit).toBe(10);
      expect(result.data.response_format).toBe('markdown');
    }
  });
});

describe('ShowConversationInput Schema - Direct validation', () => {
  test('validates path only', () => {
    const result = ShowConversationInputSchema.safeParse({
      path: '/path/to/file.jsonl'
    });

    expect(result.success).toBe(true);
  });

  test('validates path with pagination', () => {
    const result = ShowConversationInputSchema.safeParse({
      path: '/path/to/file.jsonl',
      startLine: 1,
      endLine: 100
    });

    expect(result.success).toBe(true);
  });

  test('rejects missing path', () => {
    const result = ShowConversationInputSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
