/**
 * Tool input compression for reducing token usage in conversation summaries.
 * Formats tool calls into concise, human-readable summaries.
 */

export interface ToolCallInput {
  toolName: string;
  toolInput?: unknown;
}

/**
 * Normalizes MCP tool names by removing plugin prefixes.
 * Converts "mcp__plugin_xxx__tool" to "tool"
 */
function normalizeToolName(toolName: string): string {
  // Match pattern: mcp__plugin_<anything>__<tool_name>
  // The actual tool name is after the last double underscore
  const lastUnderscoreIndex = toolName.lastIndexOf('__');
  if (lastUnderscoreIndex !== -1 && toolName.startsWith('mcp__plugin')) {
    return toolName.substring(lastUnderscoreIndex + 2);
  }
  return toolName;
}

/**
 * Extracts the first line from a string, truncating to specified length.
 */
function extractFirstLine(text: string, truncateLength = 50): string {
  if (!text) return '';
  const firstLine = text.split('\n')[0];
  if (firstLine.length <= truncateLength) {
    return firstLine;
  }
  return firstLine.substring(0, truncateLength - 3) + '...';
}

/**
 * Truncates a command string to specified length.
 */
function truncateCommand(command: string, maxLength = 80): string {
  if (command.length <= maxLength) {
    return command;
  }
  return command.substring(0, maxLength - 3) + '...';
}

/**
 * Formats an unknown tool with its input values.
 * Falls back to ToolName(key=val) format.
 */
function formatUnknownTool(toolName: string, toolInput: unknown): string {
  // Handle primitive values
  if (toolInput === null || toolInput === undefined) {
    return toolName;
  }

  if (typeof toolInput === 'string') {
    return `${toolName}("${toolInput}")`;
  }

  if (typeof toolInput === 'number' || typeof toolInput === 'boolean') {
    return `${toolName}(${String(toolInput)})`;
  }

  // Handle objects
  if (typeof toolInput === 'object') {
    const input = toolInput as Record<string, unknown>;
    const entries = Object.entries(input).slice(0, 2); // Show first 2 keys
    if (entries.length === 0) {
      return toolName;
    }
    const pairs = entries.map(([k, v]) => `${k}=${v === null ? 'null' : String(v)}`);
    return `${toolName}(${pairs.join(', ')})`;
  }

  return toolName;
}

/**
 * Format function type for tool input formatting.
 */
type ToolFormatFn = (input: unknown) => string;

/**
 * Record of formatting functions for each known tool type.
 */
const TOOL_FORMATS: Record<string, ToolFormatFn> = {
  Read: (input): string => {
    const file = (input as { file_path?: string })?.file_path;
    return file || '';
  },

  Write: (input): string => {
    const file = (input as { file_path?: string })?.file_path;
    return file || '';
  },

  Edit: (input): string => {
    const editInput = input as { file_path?: string; old_string?: string; new_string?: string };
    const file = editInput.file_path || '';
    const oldString = editInput.old_string ? extractFirstLine(editInput.old_string, 50) : '';
    if (!file) return '';
    if (oldString) {
      return `${file} (match: "${oldString}")`;
    }
    return file;
  },

  Bash: (input): string => {
    const command = (input as { command?: string })?.command || '';
    return `\`${truncateCommand(command, 80)}\``;
  },

  Grep: (input): string => {
    const grepInput = input as { pattern?: string; path?: string };
    const pattern = grepInput.pattern || '';
    const path = grepInput.path;
    return path ? `${pattern} in ${path}` : pattern;
  },

  Glob: (input): string => {
    const globInput = input as { pattern?: string; path?: string };
    const pattern = globInput.pattern || '';
    const path = globInput.path;
    return path ? `${pattern} in ${path}` : pattern;
  },

  Task: (input): string => {
    const description = (input as { description?: string })?.description || '';
    return description;
  },

  TaskCreate: (input): string => {
    const subject = (input as { subject?: string })?.subject || '';
    return subject;
  },

  TaskUpdate: (input): string => {
    const updateInput = input as { taskId?: string; status?: string };
    const taskId = updateInput.taskId || '';
    const status = updateInput.status;
    return status ? `${taskId} → ${status}` : taskId;
  },

  LSP: (input): string => {
    const lspInput = input as { operation?: string; filePath?: string };
    const operation = lspInput.operation || '';
    const filePath = lspInput.filePath || '';
    return filePath ? `${operation} on ${filePath}` : operation;
  },

  WebSearch: (input): string => {
    const query = (input as { query?: string })?.query || '';
    return `"${query}"`;
  },

  WebFetch: (input): string => {
    const url = (input as { url?: string })?.url || '';
    return url;
  },
};

/**
 * Formats a single tool call input into a summary string.
 * Returns empty string if the input cannot be formatted.
 */
function formatToolInput(toolName: string, toolInput: unknown): string {
  const normalized = normalizeToolName(toolName);
  const formatFn = TOOL_FORMATS[normalized];

  if (formatFn) {
    return formatFn(toolInput);
  }

  // Unknown tool - use fallback format
  return formatUnknownTool(normalized, toolInput);
}

/**
 * Formats tool calls into a pipe-separated summary string.
 * Groups multiple calls of the same tool together.
 *
 * @example
 * ```ts
 * formatToolSummary([
 *   { toolName: 'Read', toolInput: { file_path: '/a.ts' } },
 *   { toolName: 'Read', toolInput: { file_path: '/b.ts' } },
 *   { toolName: 'Bash', toolInput: { command: 'npm test' } }
 * ])
 * // Returns: "Read: /a.ts, /b.ts | Bash: `npm test`"
 * ```
 */
export function formatToolSummary(toolCalls: Array<{ toolName: string; toolInput?: unknown }>): string {
  if (toolCalls.length === 0) {
    return '';
  }

  // Group tool calls by normalized tool name
  const groups = new Map<string, unknown[]>();

  for (const call of toolCalls) {
    const normalized = normalizeToolName(call.toolName);
    const existing = groups.get(normalized) || [];
    existing.push(call.toolInput);
    groups.set(normalized, existing);
  }

  // Format each group, maintaining order of first appearance
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const call of toolCalls) {
    const normalized = normalizeToolName(call.toolName);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);

    const inputs = groups.get(normalized) || [];
    const results = inputs.map((input) => formatToolInput(normalized, input));

    // Check if this is a known tool (has a formatter) or unknown tool
    const isKnownTool = TOOL_FORMATS.hasOwnProperty(normalized);

    if (isKnownTool) {
      // Known tools - all results should just be the values (no tool name included)
      const nonEmptyResults = results.filter((r) => r);

      if (nonEmptyResults.length === 0) {
        // All empty - just show the tool name
        parts.push(normalized);
      } else if (nonEmptyResults.length === 1) {
        // Single result - add tool name prefix
        parts.push(`${normalized}: ${nonEmptyResults[0]}`);
      } else {
        // Multiple results - comma separate with tool name prefix
        parts.push(`${normalized}: ${nonEmptyResults.join(', ')}`);
      }
    } else {
      // Unknown tools - formatUnknownTool already includes the tool name
      // Just join the results with commas (each result already includes the tool name)
      const nonEmptyResults = results.filter((r) => r);
      if (nonEmptyResults.length === 0) {
        parts.push(normalized);
      } else if (nonEmptyResults.length === 1) {
        parts.push(nonEmptyResults[0]);
      } else {
        // Multiple unknown tool calls - comma separate
        parts.push(nonEmptyResults.join(', '));
      }
    }
  }

  return parts.join(' | ');
}
