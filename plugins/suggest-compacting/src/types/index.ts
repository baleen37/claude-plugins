// Hook input types
export interface SessionStartInput {
  session_id: string;
  transcript_path: string;
  [key: string]: unknown;
}

export interface PreToolUseInput {
  tool_name: string;
  session_id: string;
  [key: string]: unknown;
}

// State management types
export interface ToolCountState {
  count: number;
  lastSuggested?: number;
  sessionId: string;
}
