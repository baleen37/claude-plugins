/**
 * File finder for AST analysis
 * Recursively finds files matching a language, excluding common non-source directories
 */

import { readdirSync, statSync } from "fs";
import { join, extname, resolve } from "path";
import { EXT_TO_LANG } from "./language-map.js";

/**
 * Get files matching the language in a directory
 *
 * @param dirPath - Directory or file path to search
 * @param language - Target language (e.g., "typescript", "python")
 * @param maxFiles - Maximum number of files to return (default: 1000)
 * @returns Array of absolute file paths
 */
export function getFilesForLanguage(
  dirPath: string,
  language: string,
  maxFiles = 1000,
): string[] {
  const files: string[] = [];
  const extensions = Object.entries(EXT_TO_LANG)
    .filter(([_, lang]) => lang === language)
    .map(([ext]) => ext);

  function walk(dir: string) {
    if (files.length >= maxFiles) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles) return;

        const fullPath = join(dir, entry.name);

        // Skip common non-source directories
        if (entry.isDirectory()) {
          if (
            ![
              "node_modules",
              ".git",
              "dist",
              "build",
              "__pycache__",
              ".venv",
              "venv",
            ].includes(entry.name)
          ) {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  const resolvedPath = resolve(dirPath);
  const stat = statSync(resolvedPath);

  if (stat.isFile()) {
    return [resolvedPath];
  }

  walk(resolvedPath);
  return files;
}
