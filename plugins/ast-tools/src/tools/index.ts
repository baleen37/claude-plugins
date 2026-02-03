/**
 * AST Tools - Export all tools
 */

export {
  astGrepSearchTool,
  astGrepReplaceTool,
  astTools,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type AstToolDefinition,
} from "./ast-tools.js";

import { astTools } from "./ast-tools.js";

/**
 * All available AST tools
 * Compatible format for MCP server registration
 */
export const tools = astTools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  schema: tool.schema,
  handler: tool.handler,
}));
