#!/usr/bin/env bun
/**
 * Build script for conversation-memory plugin
 * Bundles the MCP server and CLI into standalone files using Bun
 */

import { mkdir, copyFile } from "fs/promises";
import { join } from "path";
import { build } from "bun";

const commonConfig = {
  target: "node",
  format: "esm",
  sourcemap: false,
  minify: false,
  // External dependencies that should not be bundled
  external: [
    "@anthropic-ai/claude-agent-sdk",
    "@huggingface/transformers",
    "better-sqlite3",
    "sharp",
    "onnxruntime-node",
    "sqlite-vec",
  ],
};

async function buildCli() {
  // Ensure output directory exists
  await mkdir("dist", { recursive: true });

  try {
    // Build CLI
    await build({
      ...commonConfig,
      entrypoints: ["src/cli/index-cli.ts"],
      outfile: "dist/cli.mjs",
      banner: {
        js: "#!/usr/bin/env bun\n",
      },
    });
    console.log("✓ Built dist/cli.mjs");

    // Build MCP server
    await build({
      ...commonConfig,
      entrypoints: ["src/mcp/server.ts"],
      outfile: "dist/mcp-server.mjs",
      banner: {
        js: "#!/usr/bin/env bun\n",
      },
    });
    console.log("✓ Built dist/mcp-server.mjs");

    // Copy wrapper script to dist/ for cached plugins
    await copyFile(
      join("scripts", "mcp-server-wrapper.mjs"),
      join("dist", "mcp-wrapper.mjs")
    );
    console.log("✓ Copied dist/mcp-wrapper.mjs");

    console.log("\n✅ Build complete!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

buildCli();
