#!/usr/bin/env node
/**
 * MCP Server for AST Tools
 *
 * Exposes ast_grep_search and ast_grep_replace via stdio transport
 * for discovery by Claude Code's MCP management system.
 *
 * Usage: node dist/mcp-server.cjs
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "../tools/index.js";
import { z } from "zod";

// Tool interface matching our tool definitions
interface ToolDef {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (
    args: unknown,
  ) => Promise<{ content: Array<{ type: "text"; text: string }> }>;
}

// Convert Zod schema to JSON Schema for MCP
function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
} {
  const rawShape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(rawShape)) {
    const zodType = value as z.ZodTypeAny;
    properties[key] = zodTypeToJsonSchema(zodType);

    // Check if required (not optional)
    const isOptional =
      zodType &&
      typeof zodType.isOptional === "function" &&
      zodType.isOptional();
    if (!isOptional) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    required,
  };
}

function zodTypeToJsonSchema(zodType: z.ZodTypeAny): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Safety check for undefined zodType
  if (!zodType || !zodType._def) {
    return { type: "string" };
  }

  // Handle optional wrapper
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zodType._def.innerType);
  }

  // Handle default wrapper
  if (zodType instanceof z.ZodDefault) {
    const inner = zodTypeToJsonSchema(zodType._def.innerType);
    inner.default = zodType._def.defaultValue();
    return inner;
  }

  // Get description if available
  const description = zodType._def?.description;
  if (description) {
    result.description = description;
  }

  // Handle basic types
  if (zodType instanceof z.ZodString) {
    result.type = "string";
  } else if (zodType instanceof z.ZodNumber) {
    result.type = zodType._def?.checks?.some(
      (c: { kind: string }) => c.kind === "int",
    )
      ? "integer"
      : "number";

    // Add min/max constraints
    const checks = zodType._def?.checks || [];
    for (const check of checks) {
      if (check.kind === "min") {
        result.minimum = check.value;
      } else if (check.kind === "max") {
        result.maximum = check.value;
      }
    }
  } else if (zodType instanceof z.ZodBoolean) {
    result.type = "boolean";
  } else if (zodType instanceof z.ZodArray) {
    result.type = "array";
    result.items = zodType._def?.type
      ? zodTypeToJsonSchema(zodType._def.type)
      : { type: "string" };
  } else if (zodType instanceof z.ZodEnum) {
    result.type = "string";
    result.enum = zodType._def?.values;
  } else if (zodType instanceof z.ZodObject) {
    return zodToJsonSchema(zodType);
  } else {
    result.type = "string";
  }

  return result;
}

// Create the MCP server
const server = new Server(
  {
    name: "ast-tools",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: (tools as unknown as ToolDef[]).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.schema),
    })),
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = (tools as unknown as ToolDef[]).find((t) => t.name === name);
  if (!tool) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Unknown tool: ${name}`,
        },
      ],
      isError: true,
    };
  }

  try {
    return await tool.handler(args);
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AST Tools MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
