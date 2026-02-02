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

import { astGrepSearch, astGrepSearchSchema } from "./ast-grep-search.js";
import { astGrepReplace, astGrepReplaceSchema } from "./ast-grep-replace.js";

/**
 * All available AST tools
 */
export const tools = [
  {
    name: "ast_grep_search",
    description:
      "Search for code patterns using AST matching with meta-variables",
    schema: astGrepSearchSchema,
    handler: astGrepSearch,
  },
  {
    name: "ast_grep_replace",
    description:
      "Replace code patterns using AST matching, preserving structure with meta-variables",
    schema: astGrepReplaceSchema,
    handler: astGrepReplace,
  },
] as const;
