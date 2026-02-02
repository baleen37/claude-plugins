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

// Session content types
export interface SessionContent {
  sessionId: string;
  timestamp: string;
  transcriptPath: string;
  conversation: string;
}
