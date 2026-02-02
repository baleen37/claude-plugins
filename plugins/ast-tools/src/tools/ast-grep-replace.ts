/**
 * AST Grep Replace Tool - Replace code patterns using AST matching
 */

import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";
import { SUPPORTED_LANGUAGES, toLangEnum } from "../lib/language-map.js";
import { getFilesForLanguage } from "../lib/file-finder.js";
import {
  getSgModule,
  getModuleNotAvailableMessage,
} from "../lib/module-loader.js";

/**
 * Zod schema for ast_grep_replace tool
 */
export const astGrepReplaceSchema = z.object({
  pattern: z.string().describe("Pattern to match"),
  replacement: z
    .string()
    .describe("Replacement pattern (use same meta-variables)"),
  language: z
    .enum(SUPPORTED_LANGUAGES)
    .describe("Programming language to transform"),
  path: z
    .string()
    .optional()
    .describe("Directory or file to search (default: current directory)"),
  dryRun: z
    .boolean()
    .optional()
    .describe("Preview only, don't apply changes (default: true)"),
});

export type AstGrepReplaceInput = z.infer<typeof astGrepReplaceSchema>;

/**
 * AST Grep Replace Tool Handler
 *
 * Replaces code patterns using AST matching with meta-variables support.
 * Preserves matched content via meta-variables in replacement pattern.
 *
 * @param args - Replace parameters (pattern, replacement, language, path, dryRun)
 * @returns Preview or confirmation of changes with before/after comparison
 */
export async function astGrepReplace(
  args: AstGrepReplaceInput,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const { pattern, replacement, language, path = ".", dryRun = true } = args;

  try {
    // Load ast-grep module with graceful degradation
    const sg = await getSgModule();
    if (!sg) {
      return {
        content: [
          {
            type: "text" as const,
            text: getModuleNotAvailableMessage(),
          },
        ],
      };
    }

    // Find files matching the language
    const files = getFilesForLanguage(path, language);

    if (files.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No ${language} files found in ${path}`,
          },
        ],
      };
    }

    const changes: {
      file: string;
      before: string;
      after: string;
      line: number;
    }[] = [];
    let totalReplacements = 0;

    // Process each file
    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const root = sg.parse(toLangEnum(sg, language), content).root();
        const matches = root.findAll(pattern);

        if (matches.length === 0) continue;

        // Collect all edits for this file
        const edits: {
          start: number;
          end: number;
          replacement: string;
          line: number;
          before: string;
        }[] = [];

        for (const match of matches) {
          const range = match.range();
          const startOffset = range.start.index;
          const endOffset = range.end.index;

          // Build replacement by substituting meta-variables
          let finalReplacement = replacement;

          // Get all captured meta-variables
          // Extract meta-variable names from replacement string
          const matchedText = match.text();

          try {
            // Replace meta-variables in the replacement string
            const metaVars =
              replacement.match(/\$\$?\$?[A-Z_][A-Z0-9_]*/g) || [];
            for (const metaVar of metaVars) {
              const varName = metaVar.replace(/^\$+/, "");
              const captured = match.getMatch(varName);
              if (captured) {
                finalReplacement = finalReplacement.replace(
                  metaVar,
                  captured.text(),
                );
              }
            }
          } catch {
            // If meta-variable extraction fails, use replacement as-is
          }

          edits.push({
            start: startOffset,
            end: endOffset,
            replacement: finalReplacement,
            line: range.start.line + 1,
            before: matchedText,
          });
        }

        // Sort edits in reverse order to apply from end to start
        // This preserves byte offsets when applying multiple edits
        edits.sort((a, b) => b.start - a.start);

        let newContent = content;
        for (const edit of edits) {
          const before = newContent.slice(edit.start, edit.end);
          newContent =
            newContent.slice(0, edit.start) +
            edit.replacement +
            newContent.slice(edit.end);

          changes.push({
            file: filePath,
            before,
            after: edit.replacement,
            line: edit.line,
          });
          totalReplacements++;
        }

        // Apply changes if not in dry-run mode
        if (!dryRun && edits.length > 0) {
          writeFileSync(filePath, newContent, "utf-8");
        }
      } catch {
        // Skip files that fail to parse
        // This is expected behavior for malformed files
      }
    }

    // No matches found
    if (changes.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No matches found for pattern: ${pattern}\n\nSearched ${files.length} ${language} file(s) in ${path}`,
          },
        ],
      };
    }

    // Format output
    const mode = dryRun ? "DRY RUN (no changes applied)" : "CHANGES APPLIED";
    const header = `${mode}\n\nFound ${totalReplacements} replacement(s) in ${files.length} file(s)\nPattern: ${pattern}\nReplacement: ${replacement}\n\n`;

    const changeList = changes
      .slice(0, 50)
      .map((c) => `${c.file}:${c.line}\n  - ${c.before}\n  + ${c.after}`)
      .join("\n\n");

    const footer =
      changes.length > 50
        ? `\n\n... and ${changes.length - 50} more changes`
        : "";

    return {
      content: [
        {
          type: "text" as const,
          text:
            header +
            changeList +
            footer +
            (dryRun ? "\n\nTo apply changes, run with dryRun: false" : ""),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error in AST replace: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Tool description for MCP server registration
 */
export const astGrepReplaceToolDescription = {
  name: "ast_grep_replace",
  description: `Replace code patterns using AST matching. Preserves matched content via meta-variables.

Use meta-variables in both pattern and replacement:
- $NAME in pattern captures a node, use $NAME in replacement to insert it
- $$$ARGS captures multiple nodes

Examples:
- Pattern: "console.log($MSG)" → Replacement: "logger.info($MSG)"
- Pattern: "var $NAME = $VALUE" → Replacement: "const $NAME = $VALUE"
- Pattern: "$OBJ.forEach(($ITEM) => { $$$BODY })" → Replacement: "for (const $ITEM of $OBJ) { $$$BODY }"

IMPORTANT: dryRun=true (default) only previews changes. Set dryRun=false to apply.`,
  inputSchema: {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string" as const,
        description: "Pattern to match",
      },
      replacement: {
        type: "string" as const,
        description: "Replacement pattern (use same meta-variables)",
      },
      language: {
        type: "string" as const,
        enum: SUPPORTED_LANGUAGES,
        description: "Programming language",
      },
      path: {
        type: "string" as const,
        description: "Directory or file to search (default: current directory)",
      },
      dryRun: {
        type: "boolean" as const,
        description: "Preview only, don't apply changes (default: true)",
      },
    },
    required: ["pattern", "replacement", "language"],
  },
};
