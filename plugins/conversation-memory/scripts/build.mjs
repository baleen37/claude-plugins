#!/usr/bin/env node
/**
 * Build script for conversation-memory plugin
 * Bundles the MCP server and CLI into standalone files using esbuild
 */

import { mkdir, copyFile } from "fs/promises";
import { join } from "path";
import { build } from "esbuild";

const commonConfig = {
  platform: "node",
  format: "esm",
  sourcemap: false,
  minify: false,
  bundle: true,
  // External dependencies that should not be bundled
  external: [
    "@huggingface/transformers",
    "better-sqlite3",
    "sharp",
    "onnxruntime-node",
    "sqlite-vec",
    "zhipuai-sdk-nodejs-v4",
  ],
};

async function buildCli() {
  // Ensure output directory exists
  await mkdir("dist", { recursive: true });

  try {
    // Build actual CLI (bundled)
    await build({
      ...commonConfig,
      entryPoints: ["src/cli/index-cli.ts"],
      outfile: "dist/cli-internal.mjs",
      banner: { js: "#!/usr/bin/env node" },
    });
    console.log("✓ Built dist/cli-internal.mjs");

    // Copy graceful wrapper (not bundled, just copied)
    await copyFile(
      join("src", "cli-graceful.mjs"),
      join("dist", "cli.mjs")
    );
    console.log("✓ Copied dist/cli.mjs (graceful wrapper)");

    // Build MCP server
    await build({
      ...commonConfig,
      entryPoints: ["src/mcp/server.ts"],
      outfile: "dist/mcp-server.mjs",
      banner: { js: "#!/usr/bin/env node" },
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
