# Memory Plugin Design

**Date**: 2026-02-03
**Author**: Jiho
**Status**: Approved

## Overview

A lightweight MCP wrapper plugin that abstracts external MCP servers (starting with `@obra/episodic-memory`) with a stable, customizable interface. When upstream MCP servers change their APIs, only configuration files need updating—no code changes required.

## Goals

1. **Abstraction**: Decouple plugin interface from upstream MCP server implementation
2. **Stability**: Keep plugin tool names/descriptions fixed when upstream changes
3. **Simplicity**: Minimal code (~180 lines total), JSON-based configuration
4. **Maintainability**: Switch MCP providers by editing config only

## Architecture

### Component Overview

```
plugins/memory/
├── .claude-plugin/
│   └── plugin.json           # Plugin metadata
├── .mcp.json                  # MCP server registration
├── config/
│   └── tools.json            # Tool mapping configuration (key file)
├── src/
│   ├── mcp/
│   │   └── server.ts         # MCP wrapper server (~80 lines)
│   └── lib/
│       ├── config-loader.ts  # JSON config loader (~40 lines)
│       └── tool-mapper.ts    # Tool mapping logic (~60 lines)
├── scripts/
│   └── build.mjs             # esbuild bundler (copy from ast-tools)
├── dist/
│   └── mcp-server.cjs        # Build output
├── package.json
└── tsconfig.json
```

### Data Flow

```
User Request
    ↓
Claude Code
    ↓
Memory Plugin MCP Server (this plugin)
    ↓ (reads config/tools.json)
Tool Mapper
    ↓ (maps tool name + params)
MCP Client → Upstream MCP Server (episodic-memory)
    ↓
Response (passed through unchanged)
    ↓
User
```

## Configuration Format

### `config/tools.json`

This is the **single source of truth** for tool definitions.

```json
{
  "upstream": {
    "command": "npx",
    "args": ["-y", "@obra/episodic-memory"]
  },
  "tools": [
    {
      "name": "memory__search",
      "description": "Search past conversation history",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Search query"
          },
          "limit": {
            "type": "number",
            "description": "Maximum results to return",
            "default": 10
          }
        },
        "required": ["query"]
      },
      "upstream": {
        "tool": "episodic-memory__search",
        "paramMapping": {
          "query": "query",
          "limit": "limit"
        }
      }
    },
    {
      "name": "memory__read",
      "description": "Read full conversation by path",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "description": "Conversation file path"
          }
        },
        "required": ["path"]
      },
      "upstream": {
        "tool": "episodic-memory__read",
        "paramMapping": {
          "path": "path"
        }
      }
    }
  ]
}
```

### Configuration Schema

```typescript
interface Config {
  upstream: {
    command: string;        // Command to run upstream MCP server
    args: string[];         // Arguments for upstream command
  };
  tools: ToolConfig[];
}

interface ToolConfig {
  name: string;             // Plugin's tool name (stable interface)
  description: string;      // Plugin's tool description
  inputSchema: object;      // JSON Schema for tool parameters
  upstream: {
    tool: string;           // Upstream MCP tool name
    paramMapping: Record<string, string>;  // my_param → upstream_param
  };
}
```

## Implementation Details

### Config Loader (`src/lib/config-loader.ts`)

```typescript
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Config {
  upstream: {
    command: string;
    args: string[];
  };
  tools: ToolConfig[];
}

interface ToolConfig {
  name: string;
  description: string;
  inputSchema: object;
  upstream: {
    tool: string;
    paramMapping: Record<string, string>;
  };
}

export async function loadConfig(): Promise<Config> {
  const configPath = join(__dirname, "../../config/tools.json");
  const raw = await readFile(configPath, "utf-8");
  return JSON.parse(raw);
}
```

### Tool Mapper (`src/lib/tool-mapper.ts`)

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

interface ToolConfig {
  name: string;
  description: string;
  inputSchema: object;
  upstream: {
    tool: string;
    paramMapping: Record<string, string>;
  };
}

export class ToolMapper {
  constructor(
    private client: Client,
    private tools: ToolConfig[]
  ) {}

  /**
   * List tools exposed by this plugin (from config)
   */
  listTools() {
    return this.tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }));
  }

  /**
   * Call upstream tool with mapped parameters
   */
  async callTool(name: string, args: Record<string, unknown>) {
    const tool = this.tools.find(t => t.name === name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Map parameters: my_param → upstream_param
    const upstreamArgs: Record<string, unknown> = {};
    for (const [myParam, upstreamParam] of Object.entries(tool.upstream.paramMapping)) {
      if (args[myParam] !== undefined) {
        upstreamArgs[upstreamParam] = args[myParam];
      }
    }

    // Forward to upstream MCP server
    return this.client.callTool({
      name: tool.upstream.tool,
      arguments: upstreamArgs
    });
  }
}
```

### MCP Server (`src/mcp/server.ts`)

```typescript
#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "../lib/config-loader.js";
import { ToolMapper } from "../lib/tool-mapper.js";

async function main() {
  // 1. Load configuration
  const config = await loadConfig();

  // 2. Create upstream MCP client
  const client = new Client(
    {
      name: "memory-client",
      version: "1.0.0"
    },
    {
      capabilities: {}
    }
  );

  // 3. Connect to upstream MCP server (subprocess)
  await client.connect(new StdioClientTransport({
    command: config.upstream.command,
    args: config.upstream.args
  }));

  // 4. Create tool mapper
  const mapper = new ToolMapper(client, config.tools);

  // 5. Create our MCP server
  const server = new Server(
    {
      name: "memory",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // 6. Handle ListTools requests
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: mapper.listTools()
  }));

  // 7. Handle CallTool requests
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      return await mapper.callTool(name, args || {});
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });

  // 8. Start server with stdio transport
  await server.connect(new StdioServerTransport());
  console.error("Memory MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
```

## Maintenance Scenarios

### Scenario 1: Switch MCP Provider

**Example**: Replace `@obra/episodic-memory` with `@new-vendor/memory-server`

**Changes required**: Edit `config/tools.json` only

```json
{
  "upstream": {
    "command": "npx",
    "args": ["-y", "@new-vendor/memory-server"]  // ← Only this line
  },
  "tools": [
    {
      "name": "memory__search",  // ← Interface stays the same
      "upstream": {
        "tool": "new-memory__search",  // ← Update upstream tool name
        "paramMapping": {
          "query": "searchQuery"  // ← Update if param names differ
        }
      }
    }
  ]
}
```

**Code changes**: None ✅

---

### Scenario 2: Add New Tool

**Example**: Add `memory__delete` tool

**Changes required**: Edit `config/tools.json` only

```json
{
  "tools": [
    {
      "name": "memory__search",
      ...
    },
    {
      "name": "memory__delete",  // ← Add new entry
      "description": "Delete conversation history",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": { "type": "string" }
        },
        "required": ["path"]
      },
      "upstream": {
        "tool": "episodic-memory__delete",
        "paramMapping": { "path": "path" }
      }
    }
  ]
}
```

**Code changes**: None ✅

---

### Scenario 3: Upstream Changes Parameter Structure

**Example**: Upstream changes `query` → `{ text: string, filters: object }`

**Option A**: Update `paramMapping` if possible (simple cases)

**Option B**: Add custom transformation logic to `tool-mapper.ts` (complex cases)

```typescript
async callTool(name: string, args: Record<string, unknown>) {
  const tool = this.tools.find(t => t.name === name);

  // Custom transformation for specific tools
  if (tool.upstream.tool === "episodic-memory__search") {
    return this.client.callTool({
      name: tool.upstream.tool,
      arguments: {
        text: args.query,      // ← Transform structure
        filters: {}
      }
    });
  }

  // Default mapping logic...
}
```

**Code changes**: Only when parameter structure transformation is needed (rare)

## Dependencies

### Runtime

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4"
  }
}
```

### Development

```json
{
  "devDependencies": {
    "typescript": "^5.3.3",
    "esbuild": "^0.20.0",
    "@types/node": "^20.0.0"
  }
}
```

## Build Process

1. **Type checking**: `tsc --noEmit`
2. **Bundling**: `esbuild src/mcp/server.ts → dist/mcp-server.cjs`
3. **Externalize**: Native modules (same as ast-tools)

### `scripts/build.mjs` (copy from ast-tools)

```javascript
import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/mcp/server.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: "dist/mcp-server.cjs",
  external: ["@modelcontextprotocol/sdk"],
  banner: {
    js: `#!/usr/bin/env node`
  }
});
```

## Testing Strategy

### Unit Tests (Future)

- Config loader: Parse valid/invalid JSON
- Tool mapper: Parameter mapping logic
- Error handling: Unknown tools, invalid parameters

### Integration Tests

- Start wrapper server → Call tools → Verify upstream calls
- Test with actual `@obra/episodic-memory` server

### Manual Testing

1. Build: `npm run build`
2. Run: `node dist/mcp-server.cjs`
3. Test tool calls via MCP protocol

## Non-Goals

- **Runtime tool discovery**: Tools must be pre-defined in config
- **Complex data transformations**: Keep transformations simple (or upstream handles it)
- **Multi-provider aggregation**: One upstream MCP server per plugin instance
- **Caching/optimization**: Pass-through only, no caching layer

## Future Enhancements (Out of Scope)

- Config validation against JSON schema
- Hot-reload config changes without restart
- Tool usage analytics/logging
- Multiple upstream servers in one plugin

## Success Criteria

- ✅ Total code < 200 lines (excluding build scripts)
- ✅ Zero code changes when switching MCP providers (config-only)
- ✅ Works with `@obra/episodic-memory` out of the box
- ✅ Build process similar to ast-tools (familiar to maintainers)

## Next Steps

1. Create plugin directory structure
2. Implement core files (server.ts, tool-mapper.ts, config-loader.ts)
3. Write initial `config/tools.json` for episodic-memory
4. Test with actual episodic-memory MCP server
5. Document usage in plugin README
