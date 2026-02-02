/**
 * AST Grep Search Tool - Find code patterns using AST matching
 */

import { z } from "zod";
import { readFileSync } from "fs";
import { SUPPORTED_LANGUAGES, toLangEnum } from "../lib/language-map.js";
import { getFilesForLanguage } from "../lib/file-finder.js";
import {
  getSgModule,
  getModuleNotAvailableMessage,
} from "../lib/module-loader.js";

/**
 * Zod schema for ast_grep_search tool
 */
export const astGrepSearchSchema = z.object({
  pattern: z
    .string()
    .describe("AST pattern with meta-variables ($VAR, $$$VARS)"),
  language: z
    .enum(SUPPORTED_LANGUAGES)
    .describe("Programming language to search"),
  path: z
    .string()
    .optional()
    .describe("Directory or file to search (default: current directory)"),
  context: z
    .number()
    .int()
    .min(0)
    .max(10)
    .optional()
    .describe("Lines of context around matches (default: 2)"),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum results to return (default: 20)"),
});

export type AstGrepSearchInput = z.infer<typeof astGrepSearchSchema>;

/**
 * Format a single match with context lines
 *
 * @param filePath - Path to the file containing the match
 * @param _matchText - The matched text (unused, prefixed with _ to indicate intentionally unused)
 * @param startLine - Starting line number (1-based)
 * @param endLine - Ending line number (1-based)
 * @param context - Number of context lines before and after
 * @param fileContent - Full content of the file
 * @returns Formatted match string with context
 */
function formatMatch(
  filePath: string,
  _matchText: string,
  startLine: number,
  endLine: number,
  context: number,
  fileContent: string,
): string {
  const lines = fileContent.split("\n");
  const contextStart = Math.max(0, startLine - context - 1);
  const contextEnd = Math.min(lines.length, endLine + context);

  const contextLines = lines.slice(contextStart, contextEnd);
  const numberedLines = contextLines.map((line, i) => {
    const lineNum = contextStart + i + 1;
    const isMatch = lineNum >= startLine && lineNum <= endLine;
    const prefix = isMatch ? ">" : " ";
    return `${prefix} ${lineNum.toString().padStart(4)}: ${line}`;
  });

  return `${filePath}:${startLine}\n${numberedLines.join("\n")}`;
}

/**
 * AST Grep Search Tool Handler
 *
 * Searches for code patterns using AST matching with meta-variables support.
 * More precise than text search as it understands code structure.
 *
 * @param args - Search parameters (pattern, language, path, context, maxResults)
 * @returns Search results with matched code and context
 */
export async function astGrepSearch(
  args: AstGrepSearchInput,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const {
    pattern,
    language,
    path = ".",
    context = 2,
    maxResults = 20,
  } = args;

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

    const results: string[] = [];
    let totalMatches = 0;

    // Search through files
    for (const filePath of files) {
      if (totalMatches >= maxResults) break;

      try {
        const content = readFileSync(filePath, "utf-8");
        const root = sg.parse(toLangEnum(sg, language), content).root();
        const matches = root.findAll(pattern);

        for (const match of matches) {
          if (totalMatches >= maxResults) break;

          const range = match.range();
          const startLine = range.start.line + 1;
          const endLine = range.end.line + 1;

          results.push(
            formatMatch(
              filePath,
              match.text(),
              startLine,
              endLine,
              context,
              content,
            ),
          );
          totalMatches++;
        }
      } catch {
        // Skip files that fail to parse
        // This is expected behavior for malformed files
      }
    }

    // No matches found
    if (results.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No matches found for pattern: ${pattern}\n\nSearched ${files.length} ${language} file(s) in ${path}\n\nTip: Ensure the pattern is a valid AST node. For example:\n- Use "function $NAME" not just "$NAME"\n- Use "console.log($X)" not "console.log"`,
          },
        ],
      };
    }

    // Return results
    const header = `Found ${totalMatches} match(es) in ${files.length} file(s)\nPattern: ${pattern}\n\n`;
    return {
      content: [
        {
          type: "text" as const,
          text: header + results.join("\n\n---\n\n"),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error in AST search: ${error instanceof Error ? error.message : String(error)}\n\nCommon issues:\n- Pattern must be a complete AST node\n- Language must match file type\n- Check that @ast-grep/napi is installed`,
        },
      ],
    };
  }
}

/**
 * Tool description for MCP server registration
 */
export const astGrepSearchToolDescription = {
  name: "ast_grep_search",
  description: `Search for code patterns using AST matching. More precise than text search.

Use meta-variables in patterns:
- $NAME - matches any single AST node (identifier, expression, etc.)
- $$$ARGS - matches multiple nodes (for function arguments, list items, etc.)

Examples:
- "function $NAME($$$ARGS)" - find all function declarations
- "console.log($MSG)" - find all console.log calls
- "if ($COND) { $$$BODY }" - find all if statements
- "$X === null" - find null equality checks
- "import $$$IMPORTS from '$MODULE'" - find imports

Note: Patterns must be valid AST nodes for the language.`,
  inputSchema: {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string" as const,
        description: "AST pattern with meta-variables ($VAR, $$$VARS)",
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
      context: {
        type: "number" as const,
        description: "Lines of context around matches (default: 2)",
        minimum: 0,
        maximum: 10,
      },
      maxResults: {
        type: "number" as const,
        description: "Maximum results to return (default: 20)",
        minimum: 1,
        maximum: 100,
      },
    },
    required: ["pattern", "language"],
  },
};
