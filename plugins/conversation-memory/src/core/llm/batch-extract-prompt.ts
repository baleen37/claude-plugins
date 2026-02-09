/**
 * Batch extraction prompt for Stop hook.
 *
 * This module provides functions to batch extract observations from tool events
 * using LLM. It's designed to be efficient by processing 10-20 events per batch
 * and allowing the LLM to return empty arrays for low-value batches.
 */

import type { LLMProvider } from './types.js';

/**
 * A compressed tool event from pending_events table.
 */
export interface CompressedEvent {
  toolName: string;
  compressed: string;
  timestamp: number;
}

/**
 * An extracted observation from LLM.
 */
export interface ExtractedObservation {
  title: string;
  content: string;
}

/**
 * Previous observation context for deduplication.
 */
export interface PreviousObservation {
  title: string;
  content: string;
}

/**
 * System prompt for batch extraction.
 * Guides the LLM to extract structured observations from tool events.
 */
const BATCH_EXTRACT_SYSTEM_PROMPT = `You are an observation extractor that analyzes Claude Code tool events and identifies meaningful insights.

Your task:
1. Analyze the batch of tool events
2. Extract meaningful observations as {title, content} pairs
3. Avoid duplicating information from previous observations
4. Return an empty JSON array if the batch contains only low-value events

Guidelines:
- Title: Keep under 50 characters, descriptive and concise
- Content: Keep under 200 characters, informative but brief
- Focus on: decisions, learnings, bugfixes, features, refactoring, debugging
- Skip: trivial operations, simple file reads, status checks, repetitive tasks
- Return JSON array only, no markdown, no explanations

Response format:
[
  {"title": "Fixed authentication bug", "content": "Resolved JWT token validation in login flow"},
  {"title": "Added test coverage", "content": "Added unit tests for auth module"}
]`;

/**
 * Build a prompt for batch extraction of observations.
 *
 * @param events - Array of compressed tool events (10-20 events)
 * @param previousObservations - Previous observations for deduplication context (last 3)
 * @returns Formatted prompt for LLM
 */
export function buildBatchExtractPrompt(
  events: CompressedEvent[],
  previousObservations: PreviousObservation[]
): string {
  let prompt = '';

  // Add previous observations context (last 3 for deduplication)
  if (previousObservations.length > 0) {
    const lastThree = previousObservations.slice(-3);
    prompt += '<previous_observations>\n';
    for (const obs of lastThree) {
      prompt += `- ${obs.title}: ${obs.content}\n`;
    }
    prompt += '</previous_observations>\n\n';
  }

  // Add tool events
  prompt += '<tool_events>\n';
  for (const event of events) {
    prompt += `[${event.timestamp}] ${event.toolName}: ${event.compressed}\n`;
  }
  prompt += '</tool_events>\n\n';

  // Add extraction instructions
  prompt += `Extract meaningful observations from these tool events.

Remember:
- title (under 50 characters)
- content (under 200 characters)
- Return empty array [] if this batch is low-value
- Avoid duplicating information from previous observations above

Return only a JSON array.`;

  return prompt;
}

/**
 * Parse LLM response into extracted observations.
 *
 * Handles:
* - Pure JSON arrays
* - Markdown code blocks with JSON
* - Malformed JSON (returns empty array)
* - Missing required fields (filters invalid entries)
 *
 * @param response - Raw LLM response text
 * @returns Array of extracted observations (empty if parsing fails)
 */
export function parseBatchExtractResponse(response: string): ExtractedObservation[] {
  try {
    // Remove markdown code blocks if present
    let jsonText = response.trim();
    if (jsonText.startsWith('```')) {
      const lines = jsonText.split('\n');
      // Find the end of the code block
      let startIndex = 0;
      let endIndex = lines.length;

      // Skip the opening ``` and ```json lines
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('```')) {
          startIndex = i + 1;
          break;
        }
      }

      // Find the closing ```
      for (let i = startIndex; i < lines.length; i++) {
        if (lines[i].trim().startsWith('```')) {
          endIndex = i;
          break;
        }
      }

      jsonText = lines.slice(startIndex, endIndex).join('\n').trim();
    }

    // Parse JSON
    const parsed = JSON.parse(jsonText) as unknown[];

    // Validate and filter
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is ExtractedObservation => {
        return (
          typeof item === 'object' &&
          item !== null &&
          typeof (item as ExtractedObservation).title === 'string' &&
          typeof (item as ExtractedObservation).content === 'string' &&
          (item as ExtractedObservation).title.trim().length > 0 &&
          (item as ExtractedObservation).content.trim().length > 0
        );
      })
      .map((item) => ({
        title: item.title.trim(),
        content: item.content.trim(),
      }));
  } catch (error) {
    // Return empty array on any parsing error
    return [];
  }
}

/**
 * Extract observations from a batch of events using LLM.
 *
 * This is the main function for batch extraction. It:
 * 1. Builds the extraction prompt with events and previous observations
 * 2. Calls the LLM provider with structured output instructions
 * 3. Parses the response into extracted observations
 * 4. Returns empty array on any error (graceful degradation)
 *
 * @param provider - LLM provider to use for extraction
 * @param events - Array of compressed tool events
 * @param previousObservations - Previous observations for deduplication context
 * @returns Array of extracted observations (empty if LLM fails or returns low-value)
 */
export async function extractObservationsFromBatch(
  provider: LLMProvider,
  events: CompressedEvent[],
  previousObservations: PreviousObservation[]
): Promise<ExtractedObservation[]> {
  try {
    const prompt = buildBatchExtractPrompt(events, previousObservations);

    const result = await provider.complete(prompt, {
      systemPrompt: BATCH_EXTRACT_SYSTEM_PROMPT,
      maxTokens: 2048,
    });

    return parseBatchExtractResponse(result.text);
  } catch (error) {
    // Return empty array on any error (graceful degradation)
    console.warn('Batch extraction failed:', error instanceof Error ? error.message : String(error));
    return [];
  }
}
