// Hook input types
export interface SessionStartInput {
  session_id: string;
  transcript_path: string;
  [key: string]: unknown;
}

export interface StopInput {
  session_id: string;
  transcript_path: string;
  [key: string]: unknown;
}

// Ralph Loop state types
export interface RalphLoopState {
  iteration: number;
  max_iterations: number;
  completion_promise: string | null;
  session_id: string;
}

export interface RalphLoopFile {
  frontmatter: RalphLoopState;
  prompt: string;
}

// Stop hook decision output
export interface StopDecision {
  decision: 'block' | 'allow';
  reason?: string;
  systemMessage?: string;
}

// Transcript message types
export interface TranscriptMessage {
  role: string;
  message: {
    content: Array<{
      type: string;
      text?: string;
    }>;
  };
}
