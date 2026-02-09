/**
 * Read tool for Layer 3 of progressive disclosure - reading raw conversation transcripts.
 *
 * This module provides functions to read conversation data from JSONL files.
 * In V3, raw conversation data is stored directly in JSONL files, not in the database.
 *
 * The read tool supports startLine/endLine pagination for large conversations
 * using 1-indexed line numbers as per spec.
 */

import * as fs from 'fs';

interface ConversationMessage {
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  type: 'user' | 'assistant';
  isSidechain: boolean;
  sessionId?: string;
  gitBranch?: string;
  cwd?: string;
  version?: string;
  message: {
    role: string;
    content: string | Array<{ type: string; text?: string; id?: string; name?: string; input?: any }>;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  toolUseResult?: Array<{ type: string; text: string }> | string;
}

/**
 * Read conversation from JSONL file.
 *
 * In V3, conversations are read directly from JSONL files.
 * The database is not used for storing raw conversation data.
 *
 * @param path - Path to JSONL file
 * @param startLine - Starting line number (1-indexed, inclusive)
 * @param endLine - Ending line number (1-indexed, inclusive)
 * @returns Markdown formatted conversation or null if not found
 */
export function readConversation(
  path: string,
  startLine?: number,
  endLine?: number
): string | null {
  // Check if file exists
  if (!fs.existsSync(path)) {
    return null;
  }

  // Read and format JSONL file
  const jsonlContent = fs.readFileSync(path, 'utf-8');
  return formatConversationAsMarkdown(jsonlContent, startLine, endLine);
}

/**
 * Format JSONL conversation as markdown.
 *
 * @param jsonl - JSONL string containing conversation messages
 * @param startLine - Starting line number (1-indexed, inclusive)
 * @param endLine - Ending line number (1-indexed, inclusive)
 * @returns Markdown formatted conversation
 */
export function formatConversationAsMarkdown(
  jsonl: string,
  startLine?: number,
  endLine?: number
): string {
  const allLines = jsonl.trim().split('\n').filter(line => line.trim());

  // Apply line range if specified (1-indexed, inclusive)
  const lines = startLine !== undefined || endLine !== undefined
    ? allLines.slice(
        startLine !== undefined ? startLine - 1 : 0,
        endLine !== undefined ? endLine : undefined
      )
    : allLines;

  const allMessages: ConversationMessage[] = lines.map(line => JSON.parse(line));

  // Filter out system messages and messages with no content
  const messages = allMessages.filter(msg => {
    if (msg.type !== 'user' && msg.type !== 'assistant') return false;
    if (!msg.timestamp) return false;
    if (!msg.message || !msg.message.content) {
      if (msg.type === 'assistant' && msg.message?.usage) return true;
      return false;
    }
    if (Array.isArray(msg.message.content) && msg.message.content.length === 0) {
      if (msg.type === 'assistant' && msg.message?.usage) return true;
      return false;
    }
    return true;
  });

  if (messages.length === 0) {
    return '';
  }

  const firstMessage = messages[0];
  let output = '# Conversation\n\n';

  // Add metadata
  output += '## Metadata\n\n';
  if (firstMessage.sessionId) {
    output += `**Session ID:** ${firstMessage.sessionId}\n\n`;
  }
  if (firstMessage.gitBranch) {
    output += `**Git Branch:** ${firstMessage.gitBranch}\n\n`;
  }
  if (firstMessage.cwd) {
    output += `**Working Directory:** ${firstMessage.cwd}\n\n`;
  }
  if (firstMessage.version) {
    output += `**Claude Code Version:** ${firstMessage.version}\n\n`;
  }

  output += '---\n\n';
  output += '## Messages\n\n';

  let inSidechain = false;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const timestamp = new Date(msg.timestamp).toLocaleString();
    const messageId = msg.uuid || `msg-${i}`;

    // Skip user messages that are just tool results
    if (msg.type === 'user' && Array.isArray(msg.message.content)) {
      const hasOnlyToolResults = msg.message.content.every(block => block.type === 'tool_result');
      if (hasOnlyToolResults) {
        continue;
      }
    }

    // Handle sidechain grouping
    if (msg.isSidechain && !inSidechain) {
      output += '\n---\n';
      output += '**🔀 SIDECHAIN START**\n';
      output += '---\n\n';
      inSidechain = true;
    } else if (!msg.isSidechain && inSidechain) {
      output += '\n---\n';
      output += '**🔀 SIDECHAIN END**\n';
      output += '---\n\n';
      inSidechain = false;
    }

    // Determine role label
    let roleLabel: string;
    if (msg.isSidechain) {
      roleLabel = msg.type === 'user' ? 'Agent' : 'Subagent';
    } else {
      roleLabel = msg.type === 'user' ? 'User' : 'Agent';
    }

    output += `### **${roleLabel}** (${timestamp}) {#${messageId}}\n\n`;

    if (msg.type === 'user') {
      // Handle tool results
      if (msg.toolUseResult) {
        output += '**Tool Result:**\n\n';
        if (typeof msg.toolUseResult === 'string') {
          output += `${msg.toolUseResult}\n\n`;
        } else if (Array.isArray(msg.toolUseResult)) {
          for (const result of msg.toolUseResult) {
            output += `${result.text || String(result)}\n\n`;
          }
        }
      } else if (typeof msg.message.content === 'string') {
        output += `${msg.message.content}\n\n`;
      } else if (Array.isArray(msg.message.content)) {
        for (const block of msg.message.content) {
          if (block.type === 'text' && block.text) {
            output += `${block.text}\n\n`;
          }
        }
      }
    } else if (msg.type === 'assistant') {
      const content = msg.message.content;
      if (typeof content === 'string') {
        output += `${content}\n\n`;
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            output += `${block.text}\n\n`;
          } else if (block.type === 'tool_use') {
            output += `**Tool Use:** \`${block.name}\`\n\n`;

            // Format tool input inline
            const input = block.input;
            if (input && typeof input === 'object') {
              for (const [key, value] of Object.entries(input)) {
                if (typeof value === 'string' && value.includes('\n')) {
                  output += `- **${key}:**\n\`\`\`\n${value}\n\`\`\`\n`;
                } else if (typeof value === 'string') {
                  output += `- **${key}:** ${value}\n`;
                } else {
                  output += `- **${key}:**\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
                }
              }
              output += '\n';
            }

            // Look for corresponding tool result
            const toolUseId = (block as any).id;
            if (toolUseId) {
              let foundResult = false;
              for (let j = i + 1; j < Math.min(i + 6, messages.length) && !foundResult; j++) {
                const laterMsg = messages[j];
                if (laterMsg.type === 'user' && Array.isArray(laterMsg.message.content)) {
                  for (const resultBlock of laterMsg.message.content) {
                    if (resultBlock.type === 'tool_result' && (resultBlock as any).tool_use_id === toolUseId) {
                      const content = (resultBlock as any).content;
                      output += '**Result:**\n';
                      if (typeof content === 'string') {
                        if (content.includes('\n') || content.length > 100) {
                          output += '```\n';
                          output += content;
                          output += '\n```\n\n';
                        } else {
                          output += `${content}\n\n`;
                        }
                      } else if (Array.isArray(content)) {
                        output += '```json\n';
                        output += JSON.stringify(content, null, 2);
                        output += '\n```\n\n';
                      }
                      foundResult = true;
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Add token usage if present
      if (msg.message.usage) {
        const usage = msg.message.usage;
        output += `_in: ${(usage.input_tokens || 0).toLocaleString()}`;
        if (usage.cache_read_input_tokens) {
          output += ` | cache read: ${usage.cache_read_input_tokens.toLocaleString()}`;
        }
        if (usage.cache_creation_input_tokens) {
          output += ` | cache create: ${usage.cache_creation_input_tokens.toLocaleString()}`;
        }
        output += ` | out: ${(usage.output_tokens || 0).toLocaleString()}_\n\n`;
      }
    }
  }

  // Close sidechain if still open
  if (inSidechain) {
    output += '\n---\n';
    output += '**🔀 SIDECHAIN END**\n';
    output += '---\n\n';
  }

  return output;
}
