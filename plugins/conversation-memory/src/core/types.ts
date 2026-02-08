export interface ToolCall {
  id: string;
  exchangeId: string;
  toolName: string;
  toolInput?: any;
  toolResult?: string;
  isError: boolean;
  timestamp: string;
}

export interface ConversationExchange {
  id: string;
  project: string;
  timestamp: string;
  userMessage: string;
  assistantMessage: string;
  archivePath: string;
  lineStart: number;
  lineEnd: number;

  // Conversation structure
  parentUuid?: string;
  isSidechain?: boolean;

  // Session context
  sessionId?: string;
  cwd?: string;
  gitBranch?: string;
  claudeVersion?: string;

  // Thinking metadata
  thinkingLevel?: string;
  thinkingDisabled?: boolean;
  thinkingTriggers?: string; // JSON array

  // Tool calls (populated separately)
  toolCalls?: ToolCall[];

  // Compressed tool summary
  compressedToolSummary?: string;
}

// Compact types for search results (without full ConversationExchange)
export interface CompactSearchResult {
  id: string;
  project: string;
  timestamp: string;
  archivePath: string;
  lineStart: number;
  lineEnd: number;
  compressedToolSummary?: string;
  similarity?: number;
  snippet: string;
}

export interface CompactMultiConceptResult {
  id: string;
  project: string;
  timestamp: string;
  archivePath: string;
  lineStart: number;
  lineEnd: number;
  compressedToolSummary?: string;
  snippet: string;
  conceptSimilarities: number[];
  averageSimilarity: number;
}

// Observation system types
export interface Observation {
  id: string;
  sessionId: string;
  project: string;
  promptNumber: number;
  timestamp: number;
  type: string;
  title: string;
  subtitle: string;
  narrative: string;
  facts: string[];
  concepts: string[];
  filesRead: string[];
  filesModified: string[];
  toolName?: string;
  correlationId?: string;
  createdAt: number;
}

export interface CompactObservation {
  id: string;
  sessionId: string;
  project: string;
  timestamp: number;
  type: string;
  title: string;
  subtitle: string;
  facts: string[];
  concepts: string[];
  filesRead: string[];
  filesModified: string[];
}

export interface SessionSummary {
  id: string;
  sessionId: string;
  project: string;
  request: string;
  investigated: string[];
  learned: string[];
  completed: string[];
  nextSteps: string[];
  notes: string;
  createdAt: number;
}

export type PendingEventType = 'tool_use' | 'summarize';

export interface PendingEvent {
  id: string;
  sessionId: string;
  eventType: PendingEventType;
  toolName?: string;
  toolInput?: any;
  toolResponse?: string;
  cwd?: string;
  timestamp: number;
  processed: boolean;
  createdAt: number;
}

// XML response types from LLM
export interface ObservationXML {
  observation: {
    type: string;
    title: string;
    subtitle: string;
    narrative: string;
    facts: string[];
    concepts: string[];
    files_read: string[];
    files_modified: string[];
    correlation_id?: string;
  };
}

export interface SkipXML {
  skip: {
    reason: string;
  };
}

export interface SessionSummaryXML {
  session_summary: {
    request: string;
    investigated: string[];
    learned: string[];
    completed: string[];
    next_steps: string[];
    notes: string;
  };
}
