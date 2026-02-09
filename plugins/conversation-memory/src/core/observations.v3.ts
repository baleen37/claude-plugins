/**
 * V3 Observations CRUD Operations
 *
 * Simplified observation system with just title + content.
 * Uses db.v3.ts for database operations.
 */

import Database from 'better-sqlite3';
import {
  ObservationV3,
  ObservationResultV3,
  insertObservationV3,
  getObservationV3,
  searchObservationsV3,
  deleteObservationV3
} from './db.v3.js';
import { generateEmbedding, initEmbeddings } from './embeddings.js';

/**
 * Simplified Observation type for public API
 */
export interface Observation {
  id: number;
  title: string;
  content: string;
  project: string;
  sessionId: string | null;
  timestamp: number;
}

/**
 * Observation with similarity score from vector search
 * Internal type used for vector search results
 */
interface ObservationWithSimilarity extends Observation {
  similarity: number;
}

/**
 * Create a new observation with embedding.
 *
 * @param db - Database instance
 * @param title - Observation title
 * @param content - Observation content
 * @param project - Project name
 * @param sessionId - Optional session ID
 * @param timestamp - Optional timestamp (defaults to now)
 * @returns The ID of the created observation
 */
export async function create(
  db: Database.Database,
  title: string,
  content: string,
  project: string,
  sessionId?: string,
  timestamp?: number
): Promise<number> {
  const now = Date.now();
  const obsTimestamp = timestamp ?? now;

  const observation: ObservationV3 = {
    title,
    content,
    project,
    sessionId,
    timestamp: obsTimestamp,
    createdAt: now
  };

  // Initialize embeddings if not already done
  await initEmbeddings();

  // Generate embedding for the observation content
  // Use title and content for better searchability
  const embeddingText = `${title}\n${content}`;
  const embedding = await generateEmbedding(embeddingText);

  return insertObservationV3(db, observation, embedding);
}

/**
 * Find a single observation by ID.
 *
 * @param db - Database instance
 * @param id - Observation ID
 * @returns Observation or null if not found
 */
export async function findById(
  db: Database.Database,
  id: number
): Promise<Observation | null> {
  const result = getObservationV3(db, id);

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    title: result.title,
    content: result.content,
    project: result.project,
    sessionId: result.sessionId,
    timestamp: result.timestamp
  };
}

/**
 * Find multiple observations by IDs.
 *
 * @param db - Database instance
 * @param ids - Array of observation IDs
 * @returns Array of observations (empty if none found)
 */
export async function findByIds(
  db: Database.Database,
  ids: number[]
): Promise<Observation[]> {
  if (ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT id, title, content, project, session_id as sessionId, timestamp
    FROM observations
    WHERE id IN (${placeholders})
    ORDER BY timestamp DESC
  `);

  const results = stmt.all(...ids) as ObservationResultV3[];

  return results.map(r => ({
    id: r.id,
    title: r.title,
    content: r.content,
    project: r.project,
    sessionId: r.sessionId,
    timestamp: r.timestamp
  }));
}

/**
 * Find observations by project.
 *
 * @param db - Database instance
 * @param project - Project name
 * @param limit - Optional limit (defaults to 100)
 * @returns Array of observations (empty if none found)
 */
export async function findByProject(
  db: Database.Database,
  project: string,
  limit: number = 100
): Promise<Observation[]> {
  const results = searchObservationsV3(db, { project, limit });

  return results.map(r => ({
    id: r.id,
    title: r.title,
    content: r.content,
    project: r.project,
    sessionId: r.sessionId,
    timestamp: r.timestamp
  }));
}

/**
 * Search observations by vector similarity.
 *
 * Uses sqlite-vec for efficient vector similarity search.
 * Returns observations ordered by similarity (highest first).
 *
 * @param db - Database instance
 * @param queryEmbedding - Query embedding vector (768 dimensions)
 * @param limit - Maximum number of results
 * @param project - Optional project filter
 * @returns Array of observations with similarity scores
 */
export async function searchByVector(
  db: Database.Database,
  queryEmbedding: number[],
  limit: number = 10,
  project?: string
): Promise<ObservationWithSimilarity[]> {
  // Use sqlite-vec's KNN query syntax with vec0 virtual table
  // Format: WHERE embedding MATCH ? AND k = ?
  const queryBuffer = Buffer.from(new Float32Array(queryEmbedding).buffer);

  let sql = `
    SELECT
      o.id,
      o.title,
      o.content,
      o.project,
      o.session_id as sessionId,
      o.timestamp,
      v.distance
    FROM observations o
    INNER JOIN vec_observations v ON CAST(o.id AS TEXT) = v.id
    WHERE v.embedding MATCH ? AND v.k = ?
  `;

  const params: any[] = [queryBuffer, limit];

  if (project) {
    sql += ' AND o.project = ?';
    params.push(project);
  }

  sql += ' ORDER BY v.distance ASC';

  const stmt = db.prepare(sql);
  const results = stmt.all(...params) as any[];

  // Convert distance to similarity (1 - distance for cosine distance)
  return results.map(row => ({
    id: row.id,
    title: row.title,
    content: row.content,
    project: row.project,
    sessionId: row.sessionId,
    timestamp: row.timestamp,
    similarity: Math.max(0, 1 - row.distance)
  }));
}

/**
 * Delete an observation by ID.
 *
 * Deletes from all three tables:
 * - observations (main table)
 * - vec_observations (vector embeddings)
 * - observations_fts (full-text search index)
 *
 * Note: Named 'deleteObservation' instead of 'delete' because delete is a reserved word.
 *
 * @param db - Database instance
 * @param id - Observation ID
 */
export async function deleteObservation(
  db: Database.Database,
  id: number
): Promise<void> {
  deleteObservationV3(db, id);
}
