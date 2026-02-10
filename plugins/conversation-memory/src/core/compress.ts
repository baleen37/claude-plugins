/**
 * Rule-based tool data compression for PostToolUse hook.
 * Compresses tool output/results for storage in pending_events table.
 * NO LLM calls - pure rule-based compression.
 */

/**
 * Tools that should be skipped (return null) as they have low value for observations.
 */
const SKIPPED_TOOLS = new Set([
  'Glob',
  'LSP',
  'TodoWrite',
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'TaskGet',
  'AskUserQuestion',
  'EnterPlanMode',
  'ExitPlanMode',
  'NotebookEdit',
  'Skill',
]);

/**
 * Truncates a string to specified length, adding '...' if truncated.
 */
function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) {
    return str || '';
  }
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Safely extracts the first line from a string.
 */
function getFirstLine(text: string | undefined): string {
  if (!text) return '';
  const firstLine = text.split('\n')[0];
  return firstLine;
}

/**
 * Type guard to check if value is a plain object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Compresses Read tool data.
 * Format: "Read /path/to/file.ts (245 lines)"
 */
function compressRead(data: unknown): string {
  if (!isObject(data)) {
    return 'Read';
  }

  const file_path = (data.file_path as string) || '';
  const lines = data.lines as number | undefined;

  let result = 'Read';
  if (file_path) {
    result += ` ${file_path}`;
  }
  if (lines !== undefined) {
    result += ` (${lines} lines)`;
  }

  return result;
}

/**
 * Compresses Edit tool data.
 * Format: "Edited /path/to/file.ts: old_string → new_string"
 */
function compressEdit(data: unknown): string {
  if (!isObject(data)) {
    return 'Edited';
  }

  const file_path = (data.file_path as string) || 'unknown file';
  const old_string = getFirstLine(data.old_string as string);
  const new_string = getFirstLine(data.new_string as string);

  const oldTruncated = truncate(old_string, 40);
  const newTruncated = truncate(new_string, 40);

  let result = `Edited ${file_path}:`;
  if (old_string) {
    result += ` ${oldTruncated}`;
  } else {
    result += ' (no old string)';
  }
  result += ' →';
  if (new_string) {
    result += ` ${newTruncated}`;
  } else {
    result += ' (no new string)';
  }

  return result;
}

/**
 * Compresses Write tool data.
 * Format: "Created /path/to/file.ts (120 lines)"
 */
function compressWrite(data: unknown): string {
  if (!isObject(data)) {
    return 'Created';
  }

  const file_path = (data.file_path as string) || '';
  const lines = data.lines as number | undefined;

  let result = 'Created';
  if (file_path) {
    result += ` ${file_path}`;
  }
  if (lines !== undefined) {
    result += ` (${lines} lines)`;
  }

  return result;
}

/**
 * Compresses Bash tool data.
 * Format: "Ran `command` → exit 0" or "Ran `command` → exit 1: error summary"
 */
function compressBash(data: unknown): string {
  if (!isObject(data)) {
    return 'Ran';
  }

  const command = (data.command as string) || 'command';
  const exitCode = data.exitCode as number | undefined;
  const stderr = data.stderr as string | undefined;

  let result = `Ran \`${command}\` →`;

  if (exitCode !== undefined) {
    result += ` exit ${exitCode}`;
  }

  if (exitCode === 1 && stderr) {
    const firstErrorLine = getFirstLine(stderr);
    const errorSummary = truncate(firstErrorLine, 100);
    if (errorSummary) {
      result += `: ${errorSummary}`;
    }
  }

  return result;
}

/**
 * Compresses Grep tool data.
 * Format: "Searched 'pattern' in /path → 5 matches"
 */
function compressGrep(data: unknown): string {
  if (!isObject(data)) {
    return 'Searched';
  }

  const pattern = (data.pattern as string) || '';
  const path = data.path as string | undefined;
  const count = data.count as number | undefined;
  const matches = data.matches as unknown[] | undefined;

  const matchCount = count !== undefined ? count : (matches?.length || 0);

  let result = `Searched '${pattern}'`;
  if (path) {
    result += ` in ${path}`;
  }
  result += ` → ${matchCount} matches`;

  return result;
}

/**
 * Compresses WebSearch tool data.
 * Format: "Searched: query text"
 */
function compressWebSearch(data: unknown): string {
  if (!isObject(data)) {
    return 'Searched:';
  }

  const query = (data.query as string) || '';
  return `Searched: ${query}`;
}

/**
 * Compresses WebFetch tool data.
 * Format: "Fetched example.com"
 */
function compressWebFetch(data: unknown): string {
  if (!isObject(data)) {
    return 'Fetched';
  }

  const url = (data.url as string) || '';
  return url ? `Fetched ${url}` : 'Fetched';
}

/**
 * Compresses tool data into a concise string for storage in pending_events.
 * Returns null for skipped tools (low value).
 *
 * @param toolName - Name of the tool that was called
 * @param toolData - Result/output data from the tool call
 * @returns Compressed string representation or null for skipped tools
 */
export function compressToolData(toolName: string, toolData: unknown): string | null {
  // Check if tool should be skipped
  if (SKIPPED_TOOLS.has(toolName)) {
    return null;
  }

  // Route to appropriate compression function
  switch (toolName) {
    case 'Read':
      return compressRead(toolData);
    case 'Edit':
      return compressEdit(toolData);
    case 'Write':
      return compressWrite(toolData);
    case 'Bash':
      return compressBash(toolData);
    case 'Grep':
      return compressGrep(toolData);
    case 'WebSearch':
      return compressWebSearch(toolData);
    case 'WebFetch':
      return compressWebFetch(toolData);
    default:
      // For unknown tools, just return the tool name
      return toolName;
  }
}
