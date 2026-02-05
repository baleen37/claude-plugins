import { ConversationExchange } from './types.js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { SUMMARIZER_CONTEXT_MARKER } from './constants.js';
import { logInfo, logError, logWarn } from './logger.js';

// Global token usage accumulator for the current sync run
let currentRunTokenUsages: TokenUsage[] = [];

export function startTokenTracking(): void {
  currentRunTokenUsages = [];
}

export function getCurrentRunTokenUsage(): TokenUsage {
  return sumTokenUsage(currentRunTokenUsages);
}

export function trackTokenUsage(usage: TokenUsage): void {
  currentRunTokenUsages.push(usage);
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface SummaryWithUsage {
  summary: string;
  tokens: TokenUsage;
}

/**
 * Get API environment overrides for summarization calls.
 * Returns full env merged with process.env so subprocess inherits PATH, HOME, etc.
 *
 * Env vars (all optional):
 * - CONVERSATION_MEMORY_API_MODEL: Model to use (default: haiku)
 * - CONVERSATION_MEMORY_API_BASE_URL: Custom API endpoint
 * - CONVERSATION_MEMORY_API_TOKEN: Auth token for custom endpoint
 * - CONVERSATION_MEMORY_API_TIMEOUT_MS: Timeout for API calls (default: SDK default)
 */
function getApiEnv(): Record<string, string | undefined> | undefined {
  const baseUrl = process.env.CONVERSATION_MEMORY_API_BASE_URL;
  const token = process.env.CONVERSATION_MEMORY_API_TOKEN;
  const timeoutMs = process.env.CONVERSATION_MEMORY_API_TIMEOUT_MS;

  if (!baseUrl && !token && !timeoutMs) {
    return undefined;
  }

  // Merge with process.env so subprocess inherits PATH, HOME, etc.
  return {
    ...process.env,
    ...(baseUrl && { ANTHROPIC_BASE_URL: baseUrl }),
    ...(token && { ANTHROPIC_AUTH_TOKEN: token }),
    ...(timeoutMs && { API_TIMEOUT_MS: timeoutMs }),
  };
}

export function formatConversationText(exchanges: ConversationExchange[]): string {
  return exchanges.map(ex => {
    return `User: ${ex.userMessage}\n\nAgent: ${ex.assistantMessage}`;
  }).join('\n\n---\n\n');
}

function extractSummary(text: string): string {
  const match = text.match(/<summary>(.*?)<\/summary>/s);
  if (match) {
    return match[1].trim();
  }
  // Fallback if no tags found
  return text.trim();
}

function extractSummaryFromResult(result: SummaryWithUsage): string {
  return extractSummary(result.summary);
}

function sumTokenUsage(usages: TokenUsage[]): TokenUsage {
  return usages.reduce((acc, usage) => ({
    input_tokens: acc.input_tokens + (usage.input_tokens || 0),
    output_tokens: acc.output_tokens + (usage.output_tokens || 0),
    cache_read_input_tokens: (acc.cache_read_input_tokens || 0) + (usage.cache_read_input_tokens || 0),
    cache_creation_input_tokens: (acc.cache_creation_input_tokens || 0) + (usage.cache_creation_input_tokens || 0),
  }), { input_tokens: 0, output_tokens: 0 });
}

function formatTokenUsage(usage: TokenUsage): string {
  const parts = [];
  parts.push(`in: ${usage.input_tokens.toLocaleString()}`);
  parts.push(`out: ${usage.output_tokens.toLocaleString()}`);
  if (usage.cache_read_input_tokens) {
    parts.push(`cache read: ${usage.cache_read_input_tokens.toLocaleString()}`);
  }
  if (usage.cache_creation_input_tokens) {
    parts.push(`cache create: ${usage.cache_creation_input_tokens.toLocaleString()}`);
  }
  return parts.join(' | ');
}

async function callClaude(prompt: string, sessionId?: string): Promise<SummaryWithUsage> {
  const model = process.env.CONVERSATION_MEMORY_API_MODEL || 'haiku';

  const apiEnv = getApiEnv();
  const apiUrl = apiEnv?.ANTHROPIC_BASE_URL || 'default';
  const hasToken = !!apiEnv?.ANTHROPIC_AUTH_TOKEN;

  logInfo('API call started', { model, apiUrl, hasToken, sessionId });
  console.log(`[CONVERSATION_MEMORY] API: ${model} @ ${apiUrl} (token: ${hasToken})`);

  for await (const message of query({
    prompt,
    options: {
      model,
      max_tokens: 4096,
      env: getApiEnv(),
      resume: sessionId,
      // Don't override systemPrompt when resuming - it uses the original session's prompt
      // Instead, the prompt itself should provide clear instructions
      ...(sessionId ? {} : {
        systemPrompt: 'Write concise, factual summaries. Output ONLY the summary - no preamble, no "Here is", no "I will". Your output will be indexed directly.'
      })
    } as any
  })) {
    if (message && typeof message === 'object' && 'type' in message && message.type === 'result') {
      const result = (message as any).result;

      // Extract token usage from result message
      const usage = (message as any).usage || { input_tokens: 0, output_tokens: 0 };
      const tokenUsage: TokenUsage = {
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
        cache_read_input_tokens: usage.cache_read_input_tokens,
        cache_creation_input_tokens: usage.cache_creation_input_tokens,
      };

      // Track token usage for current run
      trackTokenUsage(tokenUsage);

      logInfo('API call completed', {
        inputTokens: tokenUsage.input_tokens,
        outputTokens: tokenUsage.output_tokens,
        cacheReadTokens: tokenUsage.cache_read_input_tokens,
        cacheCreationTokens: tokenUsage.cache_creation_input_tokens
      });

      return {
        summary: result,
        tokens: tokenUsage,
      };
    }
  }

  logError('API call failed: No result returned');
  return {
    summary: '',
    tokens: { input_tokens: 0, output_tokens: 0 }
  };
}

function chunkExchanges(exchanges: ConversationExchange[], chunkSize: number): ConversationExchange[][] {
  const chunks: ConversationExchange[][] = [];
  for (let i = 0; i < exchanges.length; i += chunkSize) {
    chunks.push(exchanges.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Check if a conversation is trivial (not worth summarizing).
 * Uses word count instead of character count to handle multilingual content better.
 */
function isTrivialConversation(exchanges: ConversationExchange[]): boolean {
  if (exchanges.length === 0) {
    return true;
  }

  if (exchanges.length === 1) {
    const userMsg = exchanges[0].userMessage.trim();
    const assistantMsg = exchanges[0].assistantMessage.trim();

    // Check for exit command (only /exit is the official command)
    if (userMsg === '/exit') {
      return true;
    }

    // Use word count instead of character count for language-agnostic detection
    // Split on whitespace and CJK characters
    const wordCount = (userMsg + ' ' + assistantMsg)
      .split(/[\s\u3000-\u303F\u4E00-\u9FFF\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF]+/)
      .filter(word => word.length > 0).length;

    // Less than 15 words total is considered trivial
    if (wordCount < 15) {
      return true;
    }
  }

  return false;
}

export async function summarizeConversation(
  exchanges: ConversationExchange[],
  sessionId?: string,
  filename?: string
): Promise<string> {
  // Handle trivial conversations
  if (isTrivialConversation(exchanges)) {
    logInfo('Skipped trivial conversation', { filename, sessionId });
    return 'Trivial conversation with no substantive content.';
  }

  logInfo('Summarization started', { exchangeCount: exchanges.length, filename, sessionId });
  const allTokenUsages: TokenUsage[] = [];

  // For short conversations (≤15 exchanges), summarize directly
  if (exchanges.length <= 15) {
    const conversationText = sessionId
      ? '' // When resuming, no need to include conversation text - it's already in context
      : formatConversationText(exchanges);

    const prompt = `${SUMMARIZER_CONTEXT_MARKER}.

Please write a concise, factual summary of this conversation. Output ONLY the summary - no preamble. Claude will see this summary when searching previous conversations for useful memories and information.

Summarize what happened in 2-4 sentences. Be factual and specific. Output in <summary></summary> tags.

Include:
- What was built/changed/discussed (be specific)
- Key technical decisions or approaches
- Problems solved or current state

Exclude:
- Apologies, meta-commentary, or your questions
- Raw logs or debug output
- Generic descriptions - focus on what makes THIS conversation unique

Good:
<summary>Built JWT authentication for React app with refresh tokens and protected routes. Fixed token expiration bug by implementing refresh-during-request logic.</summary>

Bad:
<summary>I apologize. The conversation discussed authentication and various approaches were considered...</summary>

${conversationText}`;

    const result = await callClaude(prompt, sessionId);
    allTokenUsages.push(result.tokens);

    const summary = extractSummaryFromResult(result);
    const wordCount = summary.split(/\s+/).length;

    // Log token usage
    console.log(`  Tokens: ${formatTokenUsage(result.tokens)}`);
    logInfo('Summarization completed (direct)', {
      filename,
      wordCount,
      inputTokens: result.tokens.input_tokens,
      outputTokens: result.tokens.output_tokens
    });

    return summary;
  }

  // For long conversations, use hierarchical summarization
  console.log(`  Long conversation (${exchanges.length} exchanges) - using hierarchical summarization`);

  // Note: Hierarchical summarization doesn't support resume mode (needs fresh session for each chunk)
  // This is fine since we only use resume for the main session-end hook

  // Chunk into groups of 32 exchanges (reduced from 8 for ~75% fewer API calls)
  const chunks = chunkExchanges(exchanges, 32);
  console.log(`  Split into ${chunks.length} chunks`);

  // Summarize each chunk
  const chunkSummaries: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkText = formatConversationText(chunks[i]);
    const prompt = `${SUMMARIZER_CONTEXT_MARKER}.

Please write a concise summary of this part of a conversation in 2-3 sentences. What happened, what was built/discussed. Use <summary></summary> tags.

${chunkText}

Example: <summary>Implemented HID keyboard functionality for ESP32. Hit Bluetooth controller initialization error, fixed by adjusting memory allocation.</summary>`;

    try {
      const result = await callClaude(prompt); // No sessionId for chunks
      allTokenUsages.push(result.tokens);
      const extracted = extractSummaryFromResult(result);
      chunkSummaries.push(extracted);
      const wordCount = extracted.split(/\s+/).length;
      console.log(`  Chunk ${i + 1}/${chunks.length}: ${wordCount} words (${formatTokenUsage(result.tokens)})`);
    } catch (error) {
      console.log(`  Chunk ${i + 1} failed, skipping`);
      logError(`Chunk ${i + 1}/${chunks.length} failed`, error, { filename });
    }
  }

  if (chunkSummaries.length === 0) {
    logError('All chunks failed', undefined, { filename, chunkCount: chunks.length });
    return 'Error: Unable to summarize conversation.';
  }

  // Synthesize chunks into final summary
  const synthesisPrompt = `${SUMMARIZER_CONTEXT_MARKER}.

Please write a concise, factual summary that synthesizes these part-summaries into one cohesive paragraph. Focus on what was accomplished and any notable technical decisions or challenges. Output in <summary></summary> tags. Claude will see this summary when searching previous conversations for useful memories and information.

Part summaries:
${chunkSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Good:
<summary>Built conversation search system with JavaScript, sqlite-vec, and local embeddings. Implemented hierarchical summarization for long conversations. System archives conversations permanently and provides semantic search via CLI.</summary>

Bad:
<summary>This conversation synthesizes several topics discussed across multiple parts...</summary>

Your summary (max 200 words):`;

  console.log(`  Synthesizing final summary...`);
  try {
    const result = await callClaude(synthesisPrompt); // No sessionId for synthesis
    allTokenUsages.push(result.tokens);

    // Log total token usage
    const totalUsage = sumTokenUsage(allTokenUsages);
    console.log(`  Total tokens: ${formatTokenUsage(totalUsage)}`);

    const summary = extractSummaryFromResult(result);
    const wordCount = summary.split(/\s+/).length;

    logInfo('Summarization completed (hierarchical)', {
      filename,
      exchangeCount: exchanges.length,
      chunkCount: chunks.length,
      wordCount,
      totalInputTokens: totalUsage.input_tokens,
      totalOutputTokens: totalUsage.output_tokens
    });

    return summary;
  } catch (error) {
    console.log(`  Synthesis failed, using chunk summaries`);
    logError('Synthesis failed, using chunk summaries as fallback', error, { filename });
    return chunkSummaries.join(' ');
  }
}
