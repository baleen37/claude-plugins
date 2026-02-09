/**
 * V3 Observation-Only Search
 *
 * Simplified search using only observations table.
 * Removed:
 * - exchange-based search
 * - multi-concept (array query) search
 * - vec_exchanges table usage
 *
 * Uses:
 * - observations table (main storage)
 * - vec_observations table (vector embeddings)
 * - observations_fts table (full-text search)
 */

import Database from 'better-sqlite3';
import { generateEmbedding, initEmbeddings } from './embeddings.js';

// Constants for recency boost calculation
const BOOST_FACTOR = 0.3;
const BOOST_MIDPOINT = 0.5;

export interface SearchOptions {
  limit?: number;
  mode?: 'vector' | 'text' | 'both';
  after?: string;  // ISO date string
  before?: string; // ISO date string
  projects?: string[]; // Filter by project names
}

/**
 * Compact observation result (Layer 1 of progressive disclosure)
 */
export interface CompactObservationResult {
  id: number;
  title: string;
  project: string;
  timestamp: number;
  similarity?: number;
}

function validateISODate(dateStr: string, paramName: string): void {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(dateStr)) {
    throw new Error(`Invalid ${paramName} date: "${dateStr}". Expected YYYY-MM-DD format (e.g., 2025-10-01)`);
  }
  // Verify it's actually a valid date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ${paramName} date: "${dateStr}". Not a valid calendar date.`);
  }
}

/**
 * Convert ISO date string to Unix timestamp (milliseconds)
 */
function isoToTimestamp(isoDate: string): number {
  return new Date(isoDate).getTime();
}

/**
 * Apply recency boost to similarity scores based on timestamp.
 * Uses linear decay: today = ×1.15, 90 days = ×1.0, 180+ days = ×0.85
 *
 * @param similarity - The base similarity score (0-1)
 * @param isoTimestamp - ISO timestamp string of the observation
 * @returns The boosted similarity score
 */
export function applyRecencyBoost(similarity: number, isoTimestamp: string): number {
  const now = new Date();
  const then = new Date(isoTimestamp);
  const diffTime = Math.abs(now.getTime() - then.getTime());
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Clamp days to maximum of 180 for the boost calculation
  const t = Math.min(days / 180, 1);

  // Formula: similarity * (1 + BOOST_FACTOR * (BOOST_MIDPOINT - t))
  // When t=0 (today): 1 + BOOST_FACTOR * BOOST_MIDPOINT = 1.15
  // When t=0.5 (90 days): 1 + BOOST_FACTOR * 0 = 1.0
  // When t=1.0 (180+ days): 1 + BOOST_FACTOR * (-BOOST_MIDPOINT) = 0.85
  const boost = 1 + BOOST_FACTOR * (BOOST_MIDPOINT - t);

  return similarity * boost;
}

/**
 * Search observations using vector similarity, text matching, or both.
 * Returns compact observations (Layer 1 of progressive disclosure).
 *
 * @param query - Search query string
 * @param options - Search options
 * @returns Array of compact observation results
 */
export async function search(
  query: string,
  options: SearchOptions & { db: Database.Database }
): Promise<CompactObservationResult[]> {
  const { db, limit = 10, mode = 'both', after, before, projects } = options;

  // Validate date parameters
  if (after) validateISODate(after, '--after');
  if (before) validateISODate(before, '--before');

  let results: CompactObservationResult[] = [];

  // Build time filter clause and parameters
  const timeFilter: string[] = [];
  const timeFilterParams: number[] = [];
  if (after) {
    timeFilter.push('o.timestamp >= ?');
    timeFilterParams.push(isoToTimestamp(after));
  }
  if (before) {
    timeFilter.push('o.timestamp <= ?');
    timeFilterParams.push(isoToTimestamp(before));
  }
  const timeClause = timeFilter.length > 0 ? `AND ${timeFilter.join(' AND ')}` : '';

  // Build project filter clause
  const projectFilter: string[] = [];
  const projectFilterParams: string[] = [];
  if (projects && projects.length > 0) {
    const projectPlaceholders = projects.map(() => '?').join(',');
    projectFilter.push(`o.project IN (${projectPlaceholders})`);
    projectFilterParams.push(...projects);
  }
  const projectClause = projectFilter.length > 0 ? `AND ${projectFilter.join(' AND ')}` : '';

  if (mode === 'vector' || mode === 'both') {
    // Vector similarity search
    await initEmbeddings();
    const queryEmbedding = await generateEmbedding(query);

    const stmt = db.prepare(`
      SELECT
        o.id,
        o.title,
        o.project,
        o.timestamp,
        vec.distance
      FROM observations o
      INNER JOIN vec_observations vec ON CAST(o.id AS TEXT) = vec.id
      WHERE vec.embedding MATCH ?
        AND vec.k = ?
        ${timeClause}
        ${projectClause}
      ORDER BY vec.distance ASC
    `);

    const vectorParams = [
      Buffer.from(new Float32Array(queryEmbedding).buffer),
      limit * 2, // Get more results for better recency boost sorting
      ...timeFilterParams,
      ...projectFilterParams
    ];

    const vectorResults = stmt.all(...vectorParams) as any[];

    for (const row of vectorResults) {
      // Convert distance to similarity (1 - distance for cosine distance)
      const similarity = Math.max(0, 1 - row.distance);
      const isoTimestamp = new Date(row.timestamp).toISOString();
      const boostedSimilarity = applyRecencyBoost(similarity, isoTimestamp);

      results.push({
        id: row.id,
        title: row.title,
        project: row.project,
        timestamp: row.timestamp,
        similarity: boostedSimilarity
      });
    }
  }

  if (mode === 'text' || mode === 'both') {
    // Text-based search using FTS
    // Build filter conditions with proper table alias
    const filterConditions: string[] = [];
    const filterParams: (number | string)[] = [];

    if (after) {
      filterConditions.push('o.timestamp >= ?');
      filterParams.push(isoToTimestamp(after));
    }
    if (before) {
      filterConditions.push('o.timestamp <= ?');
      filterParams.push(isoToTimestamp(before));
    }
    if (projects && projects.length > 0) {
      const projectPlaceholders = projects.map(() => '?').join(',');
      filterConditions.push(`o.project IN (${projectPlaceholders})`);
      filterParams.push(...projects);
    }

    const whereClause = filterConditions.length > 0 ? `AND ${filterConditions.join(' AND ')}` : '';

    // Escape special FTS5 characters in the query
    // FTS5 special characters: - " * ( ) < > AND OR NOT
    // We'll wrap terms containing dots in quotes for exact phrase matching
    const ftsQuery = query.includes('.') ? `"${query}"` : query;

    const textStmt = db.prepare(`
      SELECT
        o.id,
        o.title,
        o.project,
        o.timestamp
      FROM observations o
      INNER JOIN observations_fts fts ON o.id = fts.rowid
      WHERE observations_fts MATCH ?
        ${whereClause}
      ORDER BY o.timestamp DESC
      LIMIT ?
    `);

    const textParams = [
      ftsQuery,
      ...filterParams,
      limit * 2
    ];

    const textResults = textStmt.all(...textParams) as any[];

    for (const row of textResults) {
      // Check if we already have this result from vector search
      const existing = results.find(r => r.id === row.id);
      if (existing) {
        continue;
      }

      results.push({
        id: row.id,
        title: row.title,
        project: row.project,
        timestamp: row.timestamp,
        similarity: undefined // No similarity score for text-only results
      });
    }
  }

  // Sort by similarity (highest first) then by timestamp
  results.sort((a, b) => {
    if (a.similarity !== undefined && b.similarity !== undefined) {
      return b.similarity - a.similarity;
    }
    if (a.similarity !== undefined) {
      return -1;
    }
    if (b.similarity !== undefined) {
      return 1;
    }
    return b.timestamp - a.timestamp;
  });

  // Apply limit
  return results.slice(0, limit);
}
