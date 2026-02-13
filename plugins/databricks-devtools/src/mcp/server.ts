import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { executeSql, resolveWarehouse, type SqlResult } from '../sql/executor.js';

const FULLY_QUALIFIED_TABLE_ERROR =
  'table must be fully qualified as <catalog>.<schema>.<table>';

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

function parseFullyQualifiedTable(table: string): {
  catalog: string;
  schema: string;
  name: string;
} {
  const parts = table
    .split('.')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length !== 3) {
    throw new Error(FULLY_QUALIFIED_TABLE_ERROR);
  }

  const [catalog, schema, name] = parts;
  return { catalog, schema, name };
}

function formatSqlToolResponse(
  profile: string,
  warehouseId: string,
  sql: string,
  result: SqlResult
): string {
  return JSON.stringify(
    {
      profile,
      warehouse_id: warehouseId,
      sql,
      columns: result.columns,
      rows: result.rows,
      row_count: result.rowCount,
      truncated: result.truncated,
    },
    null,
    2
  );
}

export async function listCatalogsTool(profile?: string): Promise<string> {
  const { profile: resolvedProfile, warehouseId } = await resolveWarehouse(profile);
  const sql = 'SHOW CATALOGS';
  const result = await executeSql(sql, warehouseId, resolvedProfile);
  return formatSqlToolResponse(resolvedProfile, warehouseId, sql, result);
}

export async function listSchemasTool(catalog: string, profile?: string): Promise<string> {
  const { profile: resolvedProfile, warehouseId } = await resolveWarehouse(profile);
  const sql = `SHOW SCHEMAS IN ${quoteIdentifier(catalog)}`;
  const result = await executeSql(sql, warehouseId, resolvedProfile);
  return formatSqlToolResponse(resolvedProfile, warehouseId, sql, result);
}

export async function listTablesTool(
  catalog: string,
  schema: string,
  profile?: string
): Promise<string> {
  const { profile: resolvedProfile, warehouseId } = await resolveWarehouse(profile);
  const sql = `SHOW TABLES IN ${quoteIdentifier(catalog)}.${quoteIdentifier(schema)}`;
  const result = await executeSql(sql, warehouseId, resolvedProfile);
  return formatSqlToolResponse(resolvedProfile, warehouseId, sql, result);
}

export async function describeTableTool(table: string, profile?: string): Promise<string> {
  const { catalog, schema, name } = parseFullyQualifiedTable(table);
  const { profile: resolvedProfile, warehouseId } = await resolveWarehouse(profile);
  const sql = `DESCRIBE TABLE ${quoteIdentifier(catalog)}.${quoteIdentifier(schema)}.${quoteIdentifier(name)}`;
  const result = await executeSql(sql, warehouseId, resolvedProfile);
  return formatSqlToolResponse(resolvedProfile, warehouseId, sql, result);
}

export async function tableMetadataTool(table: string, profile?: string): Promise<string> {
  const { catalog, schema, name } = parseFullyQualifiedTable(table);
  const { profile: resolvedProfile, warehouseId } = await resolveWarehouse(profile);
  const sql = `DESCRIBE DETAIL ${quoteIdentifier(catalog)}.${quoteIdentifier(schema)}.${quoteIdentifier(name)}`;
  const result = await executeSql(sql, warehouseId, resolvedProfile);
  return formatSqlToolResponse(resolvedProfile, warehouseId, sql, result);
}

export async function previewDataTool(
  table: string,
  limit = 10,
  profile?: string
): Promise<string> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error('limit must be an integer between 1 and 1000');
  }

  const { catalog, schema, name } = parseFullyQualifiedTable(table);
  const { profile: resolvedProfile, warehouseId } = await resolveWarehouse(profile);
  const sql = `SELECT * FROM ${quoteIdentifier(catalog)}.${quoteIdentifier(schema)}.${quoteIdentifier(name)} LIMIT ${limit}`;
  const result = await executeSql(sql, warehouseId, resolvedProfile);
  return formatSqlToolResponse(resolvedProfile, warehouseId, sql, result);
}

const listCatalogsArgsSchema = z
  .object({
    profile: z.string().min(1).optional(),
  })
  .default({});

const listSchemasArgsSchema = z.object({
  catalog: z.string().min(1),
  profile: z.string().min(1).optional(),
});

const listTablesArgsSchema = z.object({
  catalog: z.string().min(1),
  schema: z.string().min(1),
  profile: z.string().min(1).optional(),
});

const tableArgsSchema = z.object({
  table: z.string().min(1),
  profile: z.string().min(1).optional(),
});

const previewDataArgsSchema = z.object({
  table: z.string().min(1),
  limit: z.number().int().min(1).max(1000).optional(),
  profile: z.string().min(1).optional(),
});

const server = new Server(
  {
    name: 'databricks-devtools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_catalogs',
        description: 'List Unity Catalog catalogs.',
        inputSchema: {
          type: 'object',
          properties: {
            profile: {
              type: 'string',
              minLength: 1,
              description: 'Databricks profile name from ~/.databrickscfg',
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: 'list_schemas',
        description: 'List schemas in a catalog.',
        inputSchema: {
          type: 'object',
          properties: {
            catalog: {
              type: 'string',
              minLength: 1,
              description: 'Catalog name',
            },
            profile: {
              type: 'string',
              minLength: 1,
              description: 'Databricks profile name from ~/.databrickscfg',
            },
          },
          required: ['catalog'],
          additionalProperties: false,
        },
      },
      {
        name: 'list_tables',
        description: 'List tables in a catalog schema.',
        inputSchema: {
          type: 'object',
          properties: {
            catalog: {
              type: 'string',
              minLength: 1,
              description: 'Catalog name',
            },
            schema: {
              type: 'string',
              minLength: 1,
              description: 'Schema name',
            },
            profile: {
              type: 'string',
              minLength: 1,
              description: 'Databricks profile name from ~/.databrickscfg',
            },
          },
          required: ['catalog', 'schema'],
          additionalProperties: false,
        },
      },
      {
        name: 'describe_table',
        description: 'Describe table columns for a fully qualified table name.',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              minLength: 1,
              description: 'Fully qualified table: <catalog>.<schema>.<table>',
            },
            profile: {
              type: 'string',
              minLength: 1,
              description: 'Databricks profile name from ~/.databrickscfg',
            },
          },
          required: ['table'],
          additionalProperties: false,
        },
      },
      {
        name: 'table_metadata',
        description: 'Return metadata from DESCRIBE DETAIL for a fully qualified table.',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              minLength: 1,
              description: 'Fully qualified table: <catalog>.<schema>.<table>',
            },
            profile: {
              type: 'string',
              minLength: 1,
              description: 'Databricks profile name from ~/.databrickscfg',
            },
          },
          required: ['table'],
          additionalProperties: false,
        },
      },
      {
        name: 'preview_data',
        description: 'Preview table rows with SELECT * LIMIT n.',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              minLength: 1,
              description: 'Fully qualified table: <catalog>.<schema>.<table>',
            },
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 1000,
              description: 'Maximum rows to return (default 10)',
            },
            profile: {
              type: 'string',
              minLength: 1,
              description: 'Databricks profile name from ~/.databrickscfg',
            },
          },
          required: ['table'],
          additionalProperties: false,
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'list_catalogs': {
        const params = listCatalogsArgsSchema.parse(args);
        const result = await listCatalogsTool(params.profile);
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'list_schemas': {
        const params = listSchemasArgsSchema.parse(args);
        const result = await listSchemasTool(params.catalog, params.profile);
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'list_tables': {
        const params = listTablesArgsSchema.parse(args);
        const result = await listTablesTool(params.catalog, params.schema, params.profile);
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'describe_table': {
        const params = tableArgsSchema.parse(args);
        const result = await describeTableTool(params.table, params.profile);
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'table_metadata': {
        const params = tableArgsSchema.parse(args);
        const result = await tableMetadataTool(params.table, params.profile);
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'preview_data': {
        const params = previewDataArgsSchema.parse(args);
        const result = await previewDataTool(params.table, params.limit, params.profile);
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Error: Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  console.error('Databricks DevTools MCP server running via stdio');

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isMain = (import.meta as ImportMeta & { main?: boolean }).main === true;

if (isMain) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
