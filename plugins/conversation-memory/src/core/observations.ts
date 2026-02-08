import Database from 'better-sqlite3';
import { Observation, CompactObservation } from './types.js';
import { insertObservation } from './db.js';
import { generateEmbedding } from './embeddings.js';

/**
 * Create a new observation with embedding.
 */
export async function createObservation(
  db: Database.Database,
  observation: Observation
): Promise<void> {
  // Generate embedding for the observation narrative
  const embeddingText = `${observation.title}\n${observation.subtitle}\n${observation.narrative}`;
  const embedding = await generateEmbedding(embeddingText);

  insertObservation(db, observation, embedding);
}

/**
 * Query observations by session ID.
 */
export function getObservationsBySession(
  db: Database.Database,
  sessionId: string
): Observation[] {
  const stmt = db.prepare(`
    SELECT id, session_id as sessionId, project, prompt_number as promptNumber,
           timestamp, type, title, subtitle, narrative, facts, concepts,
           files_read as filesRead, files_modified as filesModified,
           tool_name as toolName, correlation_id as correlationId, created_at as createdAt
    FROM observations
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `);

  const rows = stmt.all(sessionId) as any[];

  return rows.map(row => ({
    ...row,
    facts: JSON.parse(row.facts),
    concepts: JSON.parse(row.concepts),
    filesRead: JSON.parse(row.filesRead),
    filesModified: JSON.parse(row.filesModified)
  }));
}

/**
 * Query observations by project.
 */
export function getObservationsByProject(
  db: Database.Database,
  project: string,
  limit?: number
): Observation[] {
  let sql = `
    SELECT id, session_id as sessionId, project, prompt_number as promptNumber,
           timestamp, type, title, subtitle, narrative, facts, concepts,
           files_read as filesRead, files_modified as filesModified,
           tool_name as toolName, correlation_id as correlationId, created_at as createdAt
    FROM observations
    WHERE project = ?
    ORDER BY timestamp DESC
  `;

  if (limit) {
    sql += ` LIMIT ${limit}`;
  }

  const stmt = db.prepare(sql);
  const rows = stmt.all(project) as any[];

  return rows.map(row => ({
    ...row,
    facts: JSON.parse(row.facts),
    concepts: JSON.parse(row.concepts),
    filesRead: JSON.parse(row.filesRead),
    filesModified: JSON.parse(row.filesModified)
  }));
}

/**
 * Query observations by type.
 */
export function getObservationsByType(
  db: Database.Database,
  type: string,
  limit?: number
): Observation[] {
  let sql = `
    SELECT id, session_id as sessionId, project, prompt_number as promptNumber,
           timestamp, type, title, subtitle, narrative, facts, concepts,
           files_read as filesRead, files_modified as filesModified,
           tool_name as toolName, correlation_id as correlationId, created_at as createdAt
    FROM observations
    WHERE type = ?
    ORDER BY timestamp DESC
  `;

  if (limit) {
    sql += ` LIMIT ${limit}`;
  }

  const stmt = db.prepare(sql);
  const rows = stmt.all(type) as any[];

  return rows.map(row => ({
    ...row,
    facts: JSON.parse(row.facts),
    concepts: JSON.parse(row.concepts),
    filesRead: JSON.parse(row.filesRead),
    filesModified: JSON.parse(row.filesModified)
  }));
}

/**
 * Query observations by date range.
 */
export function getObservationsByDateRange(
  db: Database.Database,
  startDate: number,
  endDate: number
): Observation[] {
  const stmt = db.prepare(`
    SELECT id, session_id as sessionId, project, prompt_number as promptNumber,
           timestamp, type, title, subtitle, narrative, facts, concepts,
           files_read as filesRead, files_modified as filesModified,
           tool_name as toolName, correlation_id as correlationId, created_at as createdAt
    FROM observations
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp DESC
  `);

  const rows = stmt.all(startDate, endDate) as any[];

  return rows.map(row => ({
    ...row,
    facts: JSON.parse(row.facts),
    concepts: JSON.parse(row.concepts),
    filesRead: JSON.parse(row.filesRead),
    filesModified: JSON.parse(row.filesModified)
  }));
}

/**
 * Get compact observations for search results (Layer 1 progressive disclosure).
 * Returns a smaller subset of fields for performance.
 */
export function getCompactObservations(
  db: Database.Database,
  sessionId?: string,
  project?: string,
  limit: number = 50
): CompactObservation[] {
  let sql = `
    SELECT id, session_id as sessionId, project, timestamp, type, title, subtitle,
           facts, concepts, files_read as filesRead, files_modified as filesModified
    FROM observations
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (sessionId) {
    sql += ` AND session_id = ?`;
    params.push(sessionId);
  }

  if (project) {
    sql += ` AND project = ?`;
    params.push(project);
  }

  sql += ` ORDER BY timestamp DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as any[];

  return rows.map(row => ({
    ...row,
    facts: JSON.parse(row.facts),
    concepts: JSON.parse(row.concepts),
    filesRead: JSON.parse(row.filesRead),
    filesModified: JSON.parse(row.filesModified)
  }));
}

/**
 * Validate observation data before insertion.
 */
export function validateObservation(observation: Observation): boolean {
  if (!observation.id || !observation.sessionId || !observation.project) {
    return false;
  }

  if (!observation.type || !observation.title) {
    return false;
  }

  if (!Array.isArray(observation.facts) || !Array.isArray(observation.concepts)) {
    return false;
  }

  if (!Array.isArray(observation.filesRead) || !Array.isArray(observation.filesModified)) {
    return false;
  }

  if (observation.promptNumber < 0) {
    return false;
  }

  return true;
}

/**
 * Parse and validate observation data from JSON.
 */
export function parseObservation(data: any): Observation | null {
  try {
    const observation: Observation = {
      id: data.id,
      sessionId: data.sessionId,
      project: data.project,
      promptNumber: parseInt(data.promptNumber, 10),
      timestamp: parseInt(data.timestamp, 10),
      type: data.type,
      title: data.title,
      subtitle: data.subtitle,
      narrative: data.narrative,
      facts: Array.isArray(data.facts) ? data.facts : [],
      concepts: Array.isArray(data.concepts) ? data.concepts : [],
      filesRead: Array.isArray(data.filesRead) ? data.filesRead : [],
      filesModified: Array.isArray(data.filesModified) ? data.filesModified : [],
      toolName: data.toolName,
      correlationId: data.correlationId,
      createdAt: parseInt(data.createdAt, 10)
    };

    return validateObservation(observation) ? observation : null;
  } catch (error) {
    console.warn('Failed to parse observation:', error);
    return null;
  }
}
