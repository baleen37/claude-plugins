#!/usr/bin/env node
/**
 * Build script for conversation-memory plugin
 * Bundles the MCP server and CLI into standalone files
 */

import * as esbuild from "esbuild";
import { mkdir } from "fs/promises";

const commonConfig = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  sourcemap: false,
  minify: false,
  external: [
    "@anthropic-ai/claude-agent-sdk",
    "@xenova/transformers",
    "better-sqlite3",
    "sharp",
    "onnxruntime-node",
    "sqlite-vec",
  ],
};

async function build() {
  // Ensure output directory exists
  await mkdir("dist", { recursive: true });

  try {
    // Build MCP server
    await esbuild.build({
      ...commonConfig,
      entryPoints: ["src/mcp/server.ts"],
      outfile: "dist/mcp-server.mjs",
      banner: {
        js: "#!/usr/bin/env node",
      },
    });
    console.log("✓ Built dist/mcp-server.mjs");

    // Build CLI
    await esbuild.build({
      ...commonConfig,
      entryPoints: ["src/cli/index-cli.ts"],
      outfile: "dist/cli.mjs",
      banner: {
        js: "#!/usr/bin/env node",
      },
    });
    console.log("✓ Built dist/cli.mjs");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
