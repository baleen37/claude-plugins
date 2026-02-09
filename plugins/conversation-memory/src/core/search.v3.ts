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

export interface SearchOptions {
  limit?: number;
  mode?: 'vector' | 'text' | 'both';
  after?: string;  // ISO date string
  before?: string; // ISO date string
  projects?: string[]; // Filter by project names
  files?: string[]; // Filter by file paths mentioned in content
}

/**
 * Compact observation result (Layer 1 of progressive disclosure)
 */
export interface CompactObservationResult {
  id: number;
  title: string;
  project: string;
  timestamp: number;
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { db, limit = 10, mode = 'both', after, before, projects, files } = options;

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

  // Helper function to check if content matches any of the file paths
  function matchesFiles(content: string): boolean {
    if (!files || files.length === 0) {
      return true; // No files filter, always match
    }
    return files.some(filePath => content.includes(filePath));
  }

  if (mode === 'vector' || mode === 'both') {
    // Vector similarity search
    await initEmbeddings();
    const queryEmbedding = await generateEmbedding(query);

    const stmt = db.prepare(`
      SELECT
        o.id,
        o.title,
        o.content,
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
      limit,
      ...timeFilterParams,
      ...projectFilterParams
    ];

    const vectorResults = stmt.all(...vectorParams) as any[];

    for (const row of vectorResults) {
      // Filter by files if specified
      if (!matchesFiles(row.content)) {
        continue;
      }

      results.push({
        id: row.id,
        title: row.title,
        project: row.project,
        timestamp: row.timestamp
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
        o.content,
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
      limit
    ];

    const textResults = textStmt.all(...textParams) as any[];

    for (const row of textResults) {
      // Check if we already have this result from vector search
      const existing = results.find(r => r.id === row.id);
      if (existing) {
        continue;
      }

      // Filter by files if specified
      if (!matchesFiles(row.content)) {
        continue;
      }

      results.push({
        id: row.id,
        title: row.title,
        project: row.project,
        timestamp: row.timestamp
      });
    }
  }

  return results;
}
