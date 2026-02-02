/**
 * Dynamic module loader for @ast-grep/napi
 * Provides graceful degradation when the module is not available
 */

import { createRequire } from "module";

// Dynamic import for @ast-grep/napi
// Graceful degradation: if the module is not available (e.g., in bundled/plugin context),
// tools will return a helpful error message instead of crashing
//
// IMPORTANT: Uses createRequire() (CJS resolution) instead of dynamic import() (ESM resolution)
// because ESM resolution does NOT respect NODE_PATH or Module._initPaths().
// In the MCP server plugin context, @ast-grep/napi is installed globally and resolved
// via NODE_PATH set in the bundle's startup banner.
let sgModule: typeof import("@ast-grep/napi") | null = null;
let sgLoadFailed = false;
let sgLoadError = "";

/**
 * Get the @ast-grep/napi module, loading it if necessary
 *
 * @returns The ast-grep module or null if loading failed
 */
export async function getSgModule(): Promise<typeof import("@ast-grep/napi") | null> {
  if (sgLoadFailed) {
    return null;
  }
  if (!sgModule) {
    try {
      // Use createRequire for CJS-style resolution (respects NODE_PATH)
      const require = createRequire(
        import.meta.url || __filename || process.cwd() + "/",
      );
      sgModule = require("@ast-grep/napi") as typeof import("@ast-grep/napi");
    } catch {
      // Fallback to dynamic import for pure ESM environments
      try {
        sgModule = await import("@ast-grep/napi");
      } catch (error) {
        sgLoadFailed = true;
        sgLoadError = error instanceof Error ? error.message : String(error);
        return null;
      }
    }
  }
  return sgModule;
}

/**
 * Get the error message from the last failed module load attempt
 *
 * @returns Error message or empty string if no error occurred
 */
export function getSgLoadError(): string {
  return sgLoadError;
}

/**
 * Check if the ast-grep module failed to load
 *
 * @returns True if loading failed, false otherwise
 */
export function isSgLoadFailed(): boolean {
  return sgLoadFailed;
}

/**
 * Generate a user-friendly error message for missing @ast-grep/napi
 *
 * @returns Error message with installation instructions
 */
export function getModuleNotAvailableMessage(): string {
  return `@ast-grep/napi is not available. Install it with: npm install -g @ast-grep/napi\nError: ${sgLoadError}`;
}
