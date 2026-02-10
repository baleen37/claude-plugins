/**
 * V3 MCP Server for Conversation Memory.
 *
 * Simplified 3-tool architecture:
 * 1. search - Single query string, returns compact observations
 * 2. get_observations - Full details by ID array
 * 3. read - Raw conversation from JSONL
 *
 * Progressive disclosure:
 * - Layer 1: search() returns compact observations (~30t)
 * - Layer 2: get_observations() returns full details (~200-500t)
 * - Layer 3: read() returns raw conversation (~500-2000t)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { search as searchV3 } from '../core/search.v3.js';
import { findByIds as getObservationsByIds } from '../core/observations.v3.js';
import { readConversation } from '../core/read.js';
import { openDatabase } from '../core/db.v3.js';

// Zod Schemas for Input Validation

const SearchInputSchema = z
  .object({
    query: z
      .string()
      .min(2, 'Query must be at least 2 characters')
      .describe('Search query string'),
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

export type SearchInput = z.infer<typeof SearchInputSchema>;

const GetObservationsInputSchema = z
  .object({
    ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1, 'Must provide at least 1 observation ID')
      .max(20, 'Cannot get more than 20 observations at once')
      .describe('Array of observation IDs to retrieve'),
  })
  .strict();

export type GetObservationsInput = z.infer<typeof GetObservationsInputSchema>;

const ReadInputSchema = z
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

export type ReadInput = z.infer<typeof ReadInputSchema>;

// Export schemas for testing
export { SearchInputSchema, GetObservationsInputSchema, ReadInputSchema };

// Error Handling Utility

function handleError(error: unknown): string {
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

// Create MCP Server

const server = new Server(
  {
    name: 'conversation-memory',
    version: '3.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Tools

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search',
        description: `Gives you memory across sessions using observations (structured insights) and conversations. Use BEFORE every task to recover decisions, solutions, and avoid reinventing work. Progressive disclosure: 1) search returns compact observations (~30t), 2) get_observations() for full details (~200-500t), 3) read() for raw conversation (~500-2000t). Supports semantic search, filters by projects/files, and date ranges.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              minLength: 2,
              description: 'Search query string'
            },
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 50,
              default: 10,
              description: 'Maximum number of results to return'
            },
            after: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              description: 'Only return results after this date (YYYY-MM-DD format)'
            },
            before: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              description: 'Only return results before this date (YYYY-MM-DD format)'
            },
            projects: {
              type: 'array',
              items: { type: 'string', minLength: 1 },
              description: 'Filter results to specific project names'
            },
            files: {
              type: 'array',
              items: { type: 'string', minLength: 1 },
              description: 'Filter results to specific file paths'
            },
          },
          required: ['query'],
          additionalProperties: false,
        },
        annotations: {
          title: 'Search Conversation Memory',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      {
        name: 'get_observations',
        description: `Get full observation details (Layer 2 of progressive disclosure). Use after search() to retrieve complete information including narrative, facts, concepts, and files. Returns ~200-500 tokens per observation. Essential for understanding the complete context behind decisions and discoveries.`,
        inputSchema: {
          type: 'object',
          properties: {
            ids: {
              type: 'array',
              items: { type: ['string', 'number'] },
              minItems: 1,
              maxItems: 20,
              description: 'Array of observation IDs to retrieve'
            }
          },
          required: ['ids'],
          additionalProperties: false,
        },
        annotations: {
          title: 'Get Full Observation Details',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      {
        name: 'read',
        description: `Returns compressed conversation data from indexed DB (Layer 3 of progressive disclosure). Use to extract detailed context after finding relevant observations with search() and getting full details with get_observations(). Essential for understanding the complete rationale, evolution, and gotchas behind past decisions. Use startLine/endLine pagination for large conversations to avoid context bloat (line numbers are 1-indexed).`,
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              minLength: 1,
              description: 'Path to the JSONL conversation file'
            },
            startLine: {
              type: 'number',
              minimum: 1,
              description: 'Starting line number (1-indexed, inclusive)'
            },
            endLine: {
              type: 'number',
              minimum: 1,
              description: 'Ending line number (1-indexed, inclusive)'
            },
          },
          required: ['path'],
          additionalProperties: false,
        },
        annotations: {
          title: 'Show Full Conversation',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
    ],
  };
});

// Handle Tool Calls

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (name === 'search') {
      const params = SearchInputSchema.parse(args);

      // Open V3 database (persistent storage)
      const db = openDatabase();
      try {
        // Perform search using V3 search function
        const results = await searchV3(params.query, {
          db,
          limit: params.limit,
          after: params.after,
          before: params.before,
          projects: params.projects,
          files: params.files,
        });

        // Return compact observations as JSON
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                results: results.map(r => ({
                  id: String(r.id),
                  title: r.title,
                  project: r.project,
                  timestamp: r.timestamp,
                })),
              }, null, 2),
            },
          ],
        };
      } finally {
        db.close();
      }
    }

    if (name === 'get_observations') {
      const params = GetObservationsInputSchema.parse(args);

      // Convert string IDs to numbers
      const numericIds = params.ids.map(id =>
        typeof id === 'string' ? parseInt(id, 10) : id
      );

      // Open V3 database (persistent storage)
      const db = openDatabase();
      try {
        const observations = await getObservationsByIds(db, numericIds);

        if (observations.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No observations found.',
              },
            ],
          };
        }

        let output = `Retrieved ${observations.length} observation${observations.length > 1 ? 's' : ''}:\n\n`;

        for (const obs of observations) {
          const date = new Date(obs.timestamp).toISOString().split('T')[0];
          const time = new Date(obs.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          output += `## [${obs.project}, ${date} ${time}] - ${obs.title}\n\n`;
          output += `${obs.content}\n\n`;
          output += `---\n\n`;
        }

        return { content: [{ type: 'text', text: output }] };
      } finally {
        db.close();
      }
    }

    if (name === 'read') {
      const params = ReadInputSchema.parse(args);
      const result = readConversation(params.path, params.startLine, params.endLine);
      if (result === null) {
        throw new Error(`File not found: ${params.path}`);
      }
      return { content: [{ type: 'text', text: result }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    // Return errors within the result (not as protocol errors)
    return {
      content: [
        {
          type: 'text',
          text: handleError(error),
        },
      ],
      isError: true,
    };
  }
});

// Main Function

async function main() {
  console.error('Conversation Memory V3 MCP server running via stdio');

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run the Server

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
