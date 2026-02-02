/**
 * AST Tools - Export all tools
 */

export {
  astGrepSearch,
  astGrepSearchSchema,
  type AstGrepSearchInput,
} from "./ast-grep-search.js";

export {
  astGrepReplace,
  astGrepReplaceSchema,
  type AstGrepReplaceInput,
} from "./ast-grep-replace.js";

/**
 * All available AST tools
 */
export const tools = [
  {
    name: "ast_grep_search",
    description:
      "Search for code patterns using AST matching with meta-variables",
    schema: async () => (await import("./ast-grep-search.js")).astGrepSearchSchema,
    handler: async () => (await import("./ast-grep-search.js")).astGrepSearch,
  },
  {
    name: "ast_grep_replace",
    description:
      "Replace code patterns using AST matching, preserving structure with meta-variables",
    schema: async () => (await import("./ast-grep-replace.js")).astGrepReplaceSchema,
    handler: async () => (await import("./ast-grep-replace.js")).astGrepReplace,
  },
] as const;
