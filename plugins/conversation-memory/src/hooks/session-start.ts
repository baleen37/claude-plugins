/**
 * SessionStart Hook - Token-budgeted injection of recent observations.
 *
 * This hook is triggered at session start and:
 * 1. Reads config (maxObservations, maxTokens, recencyDays, projectOnly)
 * 2. Queries recent observations for the project
 * 3. Formats as markdown
 * 4. Respects token budget (stops when maxTokens reached)
 * 5. Returns formatted markdown for injection
 *
 * Output format:
 * # [project-name] recent context (conversation-memory)
 *
 * - observation title: content
 * - ...
 */

import Database from 'better-sqlite3';
import { searchObservationsV3, type ObservationResultV3 } from '../core/db.v3.js';

/**
 * Configuration for the SessionStart hook.
 */
export interface SessionStartConfig {
  /** Maximum number of observations to include */
  maxObservations: number;
  /** Maximum tokens to use for injection (stops when reached) */
  maxTokens: number;
  /** Number of days to look back for observations */
  recencyDays: number;
  /** If true, only include observations for the current project */
  projectOnly: boolean;
}

/**
 * Result from the SessionStart hook.
 */
export interface SessionStartResult {
  /** Formatted markdown for injection */
  markdown: string;
  /** Number of observations included */
  includedCount: number;
  /** Approximate token count */
  tokenCount: number;
}

/**
 * Calculate timestamp cutoff based on recency days.
 */
function calculateRecencyCutoff(recencyDays: number): number {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  return now - recencyDays * msPerDay;
}

/**
 * Count tokens using simple approximation (chars / 4).
 * This is a rough estimate but good enough for budgeting.
 */
function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Format a single observation as a markdown bullet point.
 */
function formatObservation(obs: ObservationResultV3): string {
  // Format: "- title: content"
  return `- ${obs.title}: ${obs.content}`;
}

/**
 * Handle SessionStart hook - inject recent observations within token budget.
 *
 * @param db - Database instance
 * @param project - Current project name
 * @param config - SessionStart configuration
 * @returns Formatted markdown with recent observations
 */
export async function handleSessionStart(
  db: Database.Database,
  project: string,
  config: SessionStartConfig
): Promise<SessionStartResult> {
  const { maxObservations, maxTokens, recencyDays, projectOnly } = config;

  // Step 1: Calculate recency cutoff
  const cutoffTimestamp = calculateRecencyCutoff(recencyDays);

  // Step 2: Query recent observations
  const observations = searchObservationsV3(db, {
    project: projectOnly ? project : undefined,
    after: cutoffTimestamp,
    limit: maxObservations,
  });

  // If no observations, return empty result
  if (observations.length === 0) {
    return {
      markdown: '',
      includedCount: 0,
      tokenCount: 0,
    };
  }

  // Step 3: Format as markdown with token budget
  const header = `# ${project} recent context (conversation-memory)\n\n`;
  const headerTokens = countTokens(header);

  let markdown = header;
  let currentTokens = headerTokens;
  let includedCount = 0;

  for (const obs of observations) {
    const formatted = formatObservation(obs);
    const lineTokens = countTokens(formatted + '\n');

    // Check if adding this line would exceed token budget
    if (currentTokens + lineTokens > maxTokens) {
      // Stop adding observations
      break;
    }

    markdown += formatted + '\n';
    currentTokens += lineTokens;
    includedCount++;
  }

  // If we didn't include any observations due to token budget, return empty
  if (includedCount === 0) {
    return {
      markdown: '',
      includedCount: 0,
      tokenCount: 0,
    };
  }

  return {
    markdown,
    includedCount,
    tokenCount: currentTokens,
  };
}
