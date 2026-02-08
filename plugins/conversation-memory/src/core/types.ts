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
