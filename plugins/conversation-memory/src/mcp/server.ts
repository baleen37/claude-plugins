/**
 * MCP Server for Conversation Memory.
 *
 * This server provides tools to search and explore indexed Claude Code conversations
 * using semantic search, text search, and conversation display capabilities.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  searchMultipleConcepts,
  formatMultiConceptResults,
  searchObservations,
  formatObservationResults,
  ObservationSearchOptions,
} from '../core/search.js';
import { formatConversationAsMarkdown, readConversationFromDb } from '../core/show.js';
import { initDatabase } from '../core/db.js';
import { getObservationsByIds } from '../core/observations.js';
import fs from 'fs';

// Zod Schemas for Input Validation

const SearchModeEnum = z.enum(['vector', 'text', 'both']);
const ResponseFormatEnum = z.enum(['markdown', 'json']);

const SearchInputSchema = z
  .object({
    query: z
      .union([
        z.string().min(2, 'Query must be at least 2 characters'),
        z
          .array(z.string().min(2))
          .min(2, 'Must provide at least 2 concepts for multi-concept search')
          .max(5, 'Cannot search more than 5 concepts at once'),
      ])
      .describe(
        'Search query - string for single concept, array of strings for multi-concept AND search'
      ),
    mode: SearchModeEnum.default('both').describe(
      'Search mode: "vector" for semantic similarity, "text" for exact matching, "both" for combined (default: "both"). Only used for single-concept searches.'
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

export type SearchInput = z.infer<typeof SearchInputSchema>;

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

export type ShowConversationInput = z.infer<typeof ShowConversationInputSchema>;

const GetObservationsInputSchema = z
  .object({
    ids: z
      .array(z.string().min(1))
      .min(1, 'Must provide at least 1 observation ID')
      .max(20, 'Cannot get more than 20 observations at once')
      .describe('Array of observation IDs to retrieve'),
  })
  .strict();

export type GetObservationsInput = z.infer<typeof GetObservationsInputSchema>;

// Export schemas for testing
export { SearchInputSchema, ShowConversationInputSchema };

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
    version: '1.0.0',
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
        description: `Gives you memory across sessions using observations (structured insights) and conversations. Use BEFORE every task to recover decisions, solutions, and avoid reinventing work. Progressive disclosure: 1) search returns compact observations (~30t), 2) get_observations() for full details (~200-500t), 3) read() for raw conversation (~500-2000t). Supports semantic search, filters by type/concepts/files, and date ranges.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              oneOf: [
                { type: 'string', minLength: 2 },
                { type: 'array', items: { type: 'string', minLength: 2 }, minItems: 2, maxItems: 5 },
              ],
            },
            mode: { type: 'string', enum: ['vector', 'text', 'both'], default: 'both' },
            limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
            after: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            before: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            projects: { type: 'array', items: { type: 'string' } },
            types: { type: 'array', items: { type: 'string' } },
            concepts: { type: 'array', items: { type: 'string' } },
            files: { type: 'array', items: { type: 'string' } },
            response_format: { type: 'string', enum: ['markdown', 'json'], default: 'markdown' },
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
              items: { type: 'string', minLength: 1 },
              minItems: 1,
              maxItems: 20
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
            path: { type: 'string', minLength: 1 },
            startLine: { type: 'number', minimum: 1 },
            endLine: { type: 'number', minimum: 1 },
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
      let resultText: string;

      // Check if query is array (multi-concept) or string (single-concept)
      if (Array.isArray(params.query)) {
        // Multi-concept search (DEPRECATED - legacy exchange-based search)
        // This will emit deprecation warnings. Consider using single-concept with filters.
        // TODO: Remove multi-concept search in v7.0
        const options = {
          limit: params.limit,
          after: params.after,
          before: params.before,
        };

        const results = await searchMultipleConcepts(params.query, options);

        if (params.response_format === 'json') {
          resultText = JSON.stringify(
            {
              results: results,
              count: results.length,
              concepts: params.query,
            },
            null,
            2
          );
        } else {
          resultText = formatMultiConceptResults(results, params.query);
        }
      } else {
        // Single-concept search (use observations)
        const options: ObservationSearchOptions = {
          mode: params.mode,
          limit: params.limit,
          after: params.after,
          before: params.before,
          projects: params.projects,
          types: (args as any).types,
          concepts: (args as any).concepts,
          files: (args as any).files,
        };

        const results = await searchObservations(params.query, options);

        if (params.response_format === 'json') {
          resultText = JSON.stringify(
            {
              results: results,
              count: results.length,
              mode: params.mode,
            },
            null,
            2
          );
        } else {
          resultText = formatObservationResults(results);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    }

    if (name === 'get_observations') {
      const params = GetObservationsInputSchema.parse(args);
      const db = initDatabase();
      try {
        const observations = getObservationsByIds(db, params.ids);

        let output = `Retrieved ${observations.length} observation${observations.length > 1 ? 's' : ''}:\n\n`;

        for (const obs of observations) {
          const date = new Date(obs.timestamp).toISOString().split('T')[0];
          const time = new Date(obs.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          output += `## [${obs.project}, ${date} ${time}] - ${obs.type}: ${obs.title}\n\n`;

          if (obs.subtitle) {
            output += `**${obs.subtitle}**\n\n`;
          }

          if (obs.narrative) {
            output += `${obs.narrative}\n\n`;
          }

          if (obs.facts.length > 0) {
            output += `**Facts:**\n`;
            obs.facts.forEach((f: string) => output += `- ${f}\n`);
            output += `\n`;
          }

          if (obs.concepts.length > 0) {
            output += `**Concepts:** ${obs.concepts.map((c: string) => `\`${c}\``).join(', ')}\n\n`;
          }

          const allFiles = [...obs.filesRead, ...obs.filesModified];
          if (allFiles.length > 0) {
            const uniqueFiles = [...new Set(allFiles)];
            output += `**Files:** ${uniqueFiles.join(', ')}\n\n`;
          }

          output += `---\n\n`;
        }

        return { content: [{ type: 'text', text: output }] };
      } finally {
        db.close();
      }
    }

    if (name === 'read') {
      const params = ShowConversationInputSchema.parse(args);
      const db = initDatabase();
      try {
        // Try DB first (compressed, token-efficient)
        const dbResult = readConversationFromDb(db, params.path, params.startLine, params.endLine);
        if (dbResult) {
          return { content: [{ type: 'text', text: dbResult }] };
        }
        // Fallback: JSONL parsing for unindexed data
        if (!fs.existsSync(params.path)) throw new Error(`File not found: ${params.path}`);
        const jsonlContent = fs.readFileSync(params.path, 'utf-8');
        return { content: [{ type: 'text', text: formatConversationAsMarkdown(jsonlContent, params.startLine, params.endLine) }] };
      } finally {
        db.close();
      }
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
  console.error('Conversation Memory MCP server running via stdio');

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run the Server

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
