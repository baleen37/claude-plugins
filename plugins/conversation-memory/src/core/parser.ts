import fs from 'fs';
import readline from 'readline';
import { ConversationExchange, ToolCall } from './types.js';
import crypto from 'crypto';

// Exclusion markers that prevent a conversation from being indexed
const EXCLUSION_MARKERS = [
  'DO NOT INDEX THIS CHAT',
  'DO NOT INDEX THIS CONVERSATION',
  '이 대화는 인덱싱하지 마세요',  // Korean: "Don't index this conversation"
  '이 대화는 검색에서 제외하세요',  // Korean: "Exclude this conversation from search"
];

interface JSONLMessage {
  type: string;
  message?: {
    role: 'user' | 'assistant';
    content: string | Array<any>;
  };
  timestamp?: string;
  uuid?: string;
  parentUuid?: string;
  isSidechain?: boolean;
  sessionId?: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  thinkingMetadata?: {
    level?: string;
    disabled?: boolean;
    triggers?: Array<any>;
  };
}

/**
 * Check if conversation content contains an exclusion marker
 */
function hasExclusionMarker(content: string): boolean {
  const upperContent = content.toUpperCase();
  return EXCLUSION_MARKERS.some(marker => upperContent.includes(marker.toUpperCase()));
}

/**
 * Result type that includes exclusion status
 */
export interface ParseResult {
  exchanges: ConversationExchange[];
  isExcluded: boolean;
  exclusionReason?: string;
}

export async function parseConversation(
  filePath: string,
  projectName: string,
  archivePath: string
): Promise<ConversationExchange[]> {
  const result = await parseConversationWithResult(filePath, projectName, archivePath);
  return result.exchanges;
}

export async function parseConversationWithResult(
  filePath: string,
  projectName: string,
  archivePath: string
): Promise<ParseResult> {
  const exchanges: ConversationExchange[] = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  let currentExchange: {
    userMessage: string;
    userLine: number;
    assistantMessages: string[];
    lastAssistantLine: number;
    timestamp: string;
    parentUuid?: string;
    isSidechain?: boolean;
    sessionId?: string;
    cwd?: string;
    gitBranch?: string;
    claudeVersion?: string;
    thinkingLevel?: string;
    thinkingDisabled?: boolean;
    thinkingTriggers?: string;
    toolCalls: ToolCall[];
  } | null = null;

  const finalizeExchange = () => {
    if (currentExchange && (currentExchange.assistantMessages.length > 0 || currentExchange.toolCalls.length > 0)) {
      const exchangeId = crypto
        .createHash('md5')
        .update(`${archivePath}:${currentExchange.userLine}-${currentExchange.lastAssistantLine}`)
        .digest('hex');

      // Update tool call exchange IDs
      const toolCalls = currentExchange.toolCalls.map(tc => ({
        ...tc,
        exchangeId
      }));

      const exchange: ConversationExchange = {
        id: exchangeId,
        project: projectName,
        timestamp: currentExchange.timestamp,
        userMessage: currentExchange.userMessage,
        assistantMessage: currentExchange.assistantMessages.join('\n\n'),
        archivePath,
        lineStart: currentExchange.userLine,
        lineEnd: currentExchange.lastAssistantLine,
        parentUuid: currentExchange.parentUuid,
        isSidechain: currentExchange.isSidechain,
        sessionId: currentExchange.sessionId,
        cwd: currentExchange.cwd,
        gitBranch: currentExchange.gitBranch,
        claudeVersion: currentExchange.claudeVersion,
        thinkingLevel: currentExchange.thinkingLevel,
        thinkingDisabled: currentExchange.thinkingDisabled,
        thinkingTriggers: currentExchange.thinkingTriggers,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      };
      exchanges.push(exchange);
    }
  };

  for await (const line of rl) {
    lineNumber++;

    try {
      const parsed: JSONLMessage = JSON.parse(line);

      // Skip non-message types
      if (parsed.type !== 'user' && parsed.type !== 'assistant') {
        continue;
      }

      if (!parsed.message) {
        continue;
      }

      // Extract text from message content
      let text = '';
      const toolCalls: ToolCall[] = [];

      if (typeof parsed.message.content === 'string') {
        text = parsed.message.content;
      } else if (Array.isArray(parsed.message.content)) {
        // Extract text blocks
        const textBlocks = parsed.message.content
          .filter(block => block.type === 'text' && block.text)
          .map(block => block.text);
        text = textBlocks.join('\n');

        // Extract tool use blocks
        if (parsed.message.role === 'assistant') {
          for (const block of parsed.message.content) {
            if (block.type === 'tool_use') {
              const toolCallId = crypto.randomUUID();
              toolCalls.push({
                id: toolCallId,
                exchangeId: '', // Will be set when we know the exchange ID
                toolName: block.name || 'unknown',
                toolInput: block.input,
                isError: false,
                timestamp: parsed.timestamp || new Date().toISOString()
              });
            }
          }
        }

        // Extract tool results
        if (parsed.message.role === 'user') {
          for (const block of parsed.message.content) {
            if (block.type === 'tool_result') {
              // Store for later association with tool_use
              // For now, we'll just track results exist
              // TODO: Match tool_use_id to previous tool_use
            }
          }
        }
      }

      // Skip completely empty messages (no text, no tool calls, no tool results)
      // Note: tool_result blocks don't create tool_calls entries but are valid content
      const hasToolResults = Array.isArray(parsed.message.content) &&
        parsed.message.content.some(block => block.type === 'tool_result');
      if (!text.trim() && toolCalls.length === 0 && !hasToolResults) {
        continue;
      }

      if (parsed.message.role === 'user') {
        // Finalize previous exchange before starting new one
        finalizeExchange();

        // Start new exchange
        currentExchange = {
          userMessage: text || '(tool results only)',
          userLine: lineNumber,
          assistantMessages: [],
          lastAssistantLine: lineNumber,
          timestamp: parsed.timestamp || new Date().toISOString(),
          parentUuid: parsed.parentUuid,
          isSidechain: parsed.isSidechain,
          sessionId: parsed.sessionId,
          cwd: parsed.cwd,
          gitBranch: parsed.gitBranch,
          claudeVersion: parsed.version,
          thinkingLevel: parsed.thinkingMetadata?.level,
          thinkingDisabled: parsed.thinkingMetadata?.disabled,
          thinkingTriggers: parsed.thinkingMetadata?.triggers ? JSON.stringify(parsed.thinkingMetadata.triggers) : undefined,
          toolCalls: []
        };
      } else if (parsed.message.role === 'assistant' && currentExchange) {
        // Accumulate assistant messages
        if (text.trim()) {
          currentExchange.assistantMessages.push(text);
        }
        currentExchange.lastAssistantLine = lineNumber;

        // Add tool calls to current exchange
        if (toolCalls.length > 0) {
          currentExchange.toolCalls.push(...toolCalls);
        }

        // Update timestamp to last assistant message
        if (parsed.timestamp) {
          currentExchange.timestamp = parsed.timestamp;
        }

        // Update metadata from assistant messages (use most recent)
        if (parsed.sessionId) currentExchange.sessionId = parsed.sessionId;
        if (parsed.cwd) currentExchange.cwd = parsed.cwd;
        if (parsed.gitBranch) currentExchange.gitBranch = parsed.gitBranch;
        if (parsed.version) currentExchange.claudeVersion = parsed.version;
      }
    } catch (error) {
      // Skip malformed JSON lines
      continue;
    }
  }

  // Finalize last exchange
  finalizeExchange();

  // Check for exclusion markers in all message content
  const allContent = exchanges.map(e => `${e.userMessage} ${e.assistantMessage}`).join('\n');
  const excludedMarker = EXCLUSION_MARKERS.find(marker => allContent.toUpperCase().includes(marker.toUpperCase()));

  if (excludedMarker) {
    return {
      exchanges: [],
      isExcluded: true,
      exclusionReason: `Found exclusion marker: "${excludedMarker}"`
    };
  }

  return {
    exchanges,
    isExcluded: false
  };
}

/**
 * Convenience function to parse a conversation file
 * Extracts project name from the file path and returns exchanges with metadata
 */
export async function parseConversationFile(filePath: string): Promise<{
  project: string;
  exchanges: ConversationExchange[];
  isExcluded: boolean;
  exclusionReason?: string;
}> {
  // Extract project name from path (directory name before the .jsonl file)
  const pathParts = filePath.split('/');
  let project = 'unknown';

  // Find the parent directory name (second to last part)
  if (pathParts.length >= 2) {
    project = pathParts[pathParts.length - 2];
  }

  const result = await parseConversationWithResult(filePath, project, filePath);

  return {
    project,
    exchanges: result.exchanges,
    isExcluded: result.isExcluded,
    exclusionReason: result.exclusionReason
  };
}
