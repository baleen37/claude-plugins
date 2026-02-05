/**
 * MCP Server for Databricks DevTools.
 *
 * This server provides tools to interact with Databricks workspaces via the CLI.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { runCommand } from '../cli/runner.js';
import { parseDatabricksConfig } from '../config/databrickscfg.js';
import { getDefaultConfigPath } from '../config/profiles.js';
import type { ProfileConfig } from '../config/types.js';

// ==============
// Tool Implementations
// ==============

export async function listProfilesTool(): Promise<string> {
  const configPath = getDefaultConfigPath();

  let profiles: Record<string, ProfileConfig>;
  try {
    const config = await parseDatabricksConfig(configPath);
    profiles = config.profiles;
  } catch (error) {
    return JSON.stringify(
      {
        profiles: [],
        message: `Failed to read Databricks config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      },
      null,
      2
    );
  }

  const profileNames = Object.keys(profiles);
  const profilesWithValidity: Array<{ name: string; host?: string; valid: boolean }> = [];

  for (const name of profileNames) {
    const profile = profiles[name];
    let valid = false;

    try {
      await runCommand(['workspace', 'list', '/'], { profile: name });
      valid = true;
    } catch {
      valid = false;
    }

    profilesWithValidity.push({
      name,
      host: profile.host,
      valid,
    });
  }

  return JSON.stringify(
    {
      profiles: profilesWithValidity,
      count: profilesWithValidity.length,
      config_path: configPath,
    },
    null,
    2
  );
}

export async function getProfileInfoTool(profile: string): Promise<string> {
  const configPath = getDefaultConfigPath();

  let profiles: Record<string, ProfileConfig>;
  try {
    const config = await parseDatabricksConfig(configPath);
    profiles = config.profiles;
  } catch (error) {
    return JSON.stringify(
      {
        error: `Failed to read Databricks config: ${error instanceof Error ? error.message : String(error)}`,
      },
      null,
      2
    );
  }

  const profileConfig = profiles[profile];

  if (!profileConfig) {
    return JSON.stringify(
      {
        error: `Profile "${profile}" not found in ${configPath}`,
        available_profiles: Object.keys(profiles),
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      name: profile,
      ...profileConfig,
    },
    null,
    2
  );
}

// ==============
// Create MCP Server
// ==============

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

// ==============
// Register Tools
// ==============

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_profiles',
        description: 'List all Databricks profiles from ~/.databrickscfg with validity information.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: {
          title: 'List Databricks Profiles',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      {
        name: 'get_profile_info',
        description: 'Get detailed configuration information for a specific Databricks profile.',
        inputSchema: {
          type: 'object',
          properties: {
            profile: {
              type: 'string',
              minLength: 1,
              description: 'Databricks profile name to look up',
            },
          },
          required: ['profile'],
          additionalProperties: false,
        },
        annotations: {
          title: 'Get Profile Configuration',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
    ],
  };
});

// ==============
// Handle Tool Calls
// ==============

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'list_profiles': {
        const result = await listProfilesTool();
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'get_profile_info': {
        const params = z.object({
          profile: z.string().min(1),
        }).parse(args);
        const result = await getProfileInfoTool(params.profile);
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

// ==============
// Main Function
// ==============

async function main() {
  console.error('Databricks DevTools MCP server running via stdio');

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ==============
// Run the Server
// ==============

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
