// Hook input types
export interface PreToolUseInput {
  tool_name: string;
  command?: string;
  session_id?: string;
  [key: string]: unknown;
}

export interface CommandInput {
  command: string;
  [key: string]: unknown;
}
