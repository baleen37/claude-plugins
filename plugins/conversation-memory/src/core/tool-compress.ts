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
 * Handles primitives, objects, and arrays.
 */
function formatUnknownTool(toolName: string, toolInput: unknown): FormatResult {
  // Handle primitive values
  if (toolInput === null || toolInput === undefined) {
    return { formatted: toolName, includesName: true };
  }

  if (typeof toolInput === 'string') {
    return { formatted: `${toolName}("${toolInput}")`, includesName: true };
  }

  if (typeof toolInput === 'number' || typeof toolInput === 'boolean') {
    return { formatted: `${toolName}(${String(toolInput)})`, includesName: true };
  }

  // Handle objects
  if (typeof toolInput === 'object') {
    const input = toolInput as Record<string, unknown>;
    const entries = Object.entries(input).slice(0, 2); // Show first 2 keys
    if (entries.length === 0) {
      return { formatted: toolName, includesName: true };
    }
    const pairs = entries.map(([k, v]) => `${k}=${v === null ? 'null' : String(v)}`);
    return { formatted: `${toolName}(${pairs.join(', ')})`, includesName: true };
  }

  return { formatted: toolName, includesName: true };
}

/**
 * Format result that indicates whether the tool name is already included.
 */
interface FormatResult {
  /** The formatted string */
  formatted: string;
  /** Whether the tool name is already included in the formatted string */
  includesName: boolean;
}

/**
 * Format function type for tool input formatting.
 */
type ToolFormatFn = (input: unknown) => FormatResult;

/**
 * Record of formatting functions for each known tool type.
 */
const TOOL_FORMATS: Record<string, ToolFormatFn> = {
  Read: (input): FormatResult => {
    const file = (input as { file_path?: string })?.file_path;
    if (!file) return { formatted: '', includesName: false };
    return { formatted: file, includesName: false };
  },

  Write: (input): FormatResult => {
    const file = (input as { file_path?: string })?.file_path;
    if (!file) return { formatted: '', includesName: false };
    return { formatted: file, includesName: false };
  },

  Edit: (input): FormatResult => {
    const editInput = input as { file_path?: string; old_string?: string; new_string?: string };
    const file = editInput.file_path || '';
    const oldString = editInput.old_string ? extractFirstLine(editInput.old_string, 50) : '';
    if (!file) return { formatted: '', includesName: false };
    if (oldString) {
      return { formatted: `${file} (match: "${oldString}")`, includesName: false };
    }
    return { formatted: file, includesName: false };
  },

  Bash: (input): FormatResult => {
    const command = (input as { command?: string })?.command || '';
    return { formatted: `\`${truncateCommand(command, 80)}\``, includesName: false };
  },

  Grep: (input): FormatResult => {
    const grepInput = input as { pattern?: string; path?: string };
    const pattern = grepInput.pattern || '';
    const path = grepInput.path;
    const formatted = path ? `${pattern} in ${path}` : pattern;
    return { formatted, includesName: false };
  },

  Glob: (input): FormatResult => {
    const globInput = input as { pattern?: string; path?: string };
    const pattern = globInput.pattern || '';
    const path = globInput.path;
    const formatted = path ? `${pattern} in ${path}` : pattern;
    return { formatted, includesName: false };
  },

  Task: (input): FormatResult => {
    const description = (input as { description?: string })?.description || '';
    return { formatted: description, includesName: false };
  },

  TaskCreate: (input): FormatResult => {
    const subject = (input as { subject?: string })?.subject || '';
    return { formatted: subject, includesName: false };
  },

  TaskUpdate: (input): FormatResult => {
    const updateInput = input as { taskId?: string; status?: string };
    const taskId = updateInput.taskId || '';
    const status = updateInput.status;
    const formatted = status ? `${taskId} → ${status}` : taskId;
    return { formatted, includesName: false };
  },

  LSP: (input): FormatResult => {
    const lspInput = input as { operation?: string; filePath?: string };
    const operation = lspInput.operation || '';
    const filePath = lspInput.filePath || '';
    const formatted = filePath ? `${operation} on ${filePath}` : operation;
    return { formatted, includesName: false };
  },

  WebSearch: (input): FormatResult => {
    const query = (input as { query?: string })?.query || '';
    return { formatted: `"${query}"`, includesName: false };
  },

  WebFetch: (input): FormatResult => {
    const url = (input as { url?: string })?.url || '';
    return { formatted: url, includesName: false };
  },
};

/**
 * Formats a single tool call into a summary string.
 */
function formatToolCall(toolName: string, toolInput: unknown): FormatResult {
  const normalized = normalizeToolName(toolName);
  const formatFn = TOOL_FORMATS[normalized];

  if (formatFn) {
    const result = formatFn(toolInput);
    if (!result.formatted) {
      return { formatted: normalized, includesName: true };
    }
    return result;
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
    const results = inputs.map((input) => formatToolCall(normalized, input));

    // Separate results by whether they include the name
    const withName: string[] = [];
    const withoutName: string[] = [];

    for (const result of results) {
      if (!result.formatted) continue;
      if (result.includesName) {
        withName.push(result.formatted);
      } else {
        withoutName.push(result.formatted);
      }
    }

    // Build the output string
    if (withoutName.length > 0 && withName.length > 0) {
      // Mix of both - combine with tool name prefix
      const withoutPart = `${normalized}: ${withoutName.join(', ')}`;
      parts.push(withoutPart, ...withName);
    } else if (withoutName.length > 0) {
      // Only results without name - add tool name prefix
      if (withoutName.length === 1) {
        parts.push(`${normalized}: ${withoutName[0]}`);
      } else {
        parts.push(`${normalized}: ${withoutName.join(', ')}`);
      }
    } else if (withName.length > 0) {
      // Only results with name - just use them
      if (withName.length === 1) {
        parts.push(withName[0]);
      } else {
        // Multiple results that already include the name
        parts.push(`${normalized}: ${withName.join(', ')}`);
      }
    } else {
      // All empty - just show the tool name
      parts.push(normalized);
    }
  }

  return parts.join(' | ');
}
