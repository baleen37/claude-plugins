import Database from 'better-sqlite3';
import { SessionSummary } from './types.js';
import { getSessionSummary, insertSessionSummary } from './db.js';
import { parseSummaryResponse } from './observation-prompt.js';

/**
 * Get the most recent session summary.
 */
export function getLatestSessionSummary(
  db: Database.Database,
  sessionId: string
): SessionSummary | null {
  return getSessionSummary(db, sessionId);
}

/**
 * Save a session summary.
 */
export function saveSessionSummary(
  db: Database.Database,
  summary: SessionSummary
): void {
  insertSessionSummary(db, summary);
}

/**
 * Generate and save a session summary from LLM response.
 */
export function processSessionSummary(
  db: Database.Database,
  llmResponse: string,
  sessionId: string,
  project: string
): SessionSummary | null {
  const summary = parseSummaryResponse(llmResponse, sessionId, project);

  if (summary) {
    saveSessionSummary(db, summary);
  }

  return summary;
}

/**
 * Check if a session has a summary.
 */
export function hasSessionSummary(
  db: Database.Database,
  sessionId: string
): boolean {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM session_summaries
    WHERE session_id = ?
  `);

  const result = stmt.get(sessionId) as { count: number };
  return result.count > 0;
}

/**
 * Get all session summaries for a project.
 */
export function getProjectSessionSummaries(
  db: Database.Database,
  project: string
): SessionSummary[] {
  const stmt = db.prepare(`
    SELECT id, session_id as sessionId, project, request, investigated, learned,
           completed, next_steps as nextSteps, notes, created_at as createdAt
    FROM session_summaries
    WHERE project = ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(project) as any[];

  return rows.map(row => ({
    id: row.id,
    sessionId: row.sessionId,
    project: row.project,
    request: row.request,
    investigated: JSON.parse(row.investigated),
    learned: JSON.parse(row.learned),
    completed: JSON.parse(row.completed),
    nextSteps: JSON.parse(row.nextSteps),
    notes: row.notes,
    createdAt: row.createdAt
  }));
}
