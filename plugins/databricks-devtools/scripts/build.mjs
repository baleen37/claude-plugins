#!/usr/bin/env node
/**
 * Build script for databricks-devtools plugin
 * Compiles TypeScript and bundles the MCP server
 */

import * as esbuild from "esbuild";
import { mkdir, copyFile } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const commonConfig = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  sourcemap: false,
  minify: false,
  external: [],
};

async function build() {
  // Ensure output directory exists
  await mkdir("dist", { recursive: true });

  try {
    // First, compile TypeScript to JavaScript in dist/
    console.log("Compiling TypeScript...");
    await execAsync("npx tsc --project tsconfig.json");
    console.log("✓ TypeScript compiled");

    // Then bundle the compiled JS
    await esbuild.build({
      ...commonConfig,
      entryPoints: ["dist/mcp/server.js"],
      outfile: "dist/mcp-server.mjs",
      banner: {
        js: "#!/usr/bin/env node",
      },
    });
    console.log("✓ Built dist/mcp-server.mjs");

    // Copy wrapper script to dist/ for cached plugins
    await copyFile(
      join("scripts", "mcp-server-wrapper.mjs"),
      join("dist", "mcp-wrapper.mjs")
    );
    console.log("✓ Copied dist/mcp-wrapper.mjs");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
