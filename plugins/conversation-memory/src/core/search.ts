import Database from 'better-sqlite3';
import { initDatabase } from './db.js';
import { initEmbeddings, generateEmbedding } from './embeddings.js';
import { CompactSearchResult, CompactMultiConceptResult } from './types.js';

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
 * Apply recency boost to similarity scores based on timestamp.
 * Uses linear decay: today = ×1.15, 90 days = ×1.0, 180+ days = ×0.85
 *
 * @param similarity - The base similarity score (0-1)
 * @param timestamp - ISO timestamp string of the conversation
 * @returns The boosted similarity score
 */
export function applyRecencyBoost(similarity: number, timestamp: string): number {
  const now = new Date();
  const then = new Date(timestamp);
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

export async function searchConversations(
  query: string,
  options: SearchOptions = {}
): Promise<CompactSearchResult[]> {
  const { limit = 10, mode = 'both', after, before, projects } = options;

  // Validate date parameters
  if (after) validateISODate(after, '--after');
  if (before) validateISODate(before, '--before');

  const db = initDatabase();

  let results: any[] = [];

  // Build time filter clause and parameters
  const timeFilter: string[] = [];
  const timeFilterParams: string[] = [];
  if (after) {
    timeFilter.push('e.timestamp >= ?');
    timeFilterParams.push(after);
  }
  if (before) {
    timeFilter.push('e.timestamp <= ?');
    timeFilterParams.push(before);
  }
  const timeClause = timeFilter.length > 0 ? `AND ${timeFilter.join(' AND ')}` : '';

  // Build project filter clause
  const projectFilter: string[] = [];
  if (projects && projects.length > 0) {
    const projectPlaceholders = projects.map(() => '?').join(',');
    projectFilter.push(`e.project IN (${projectPlaceholders})`);
  }
  const projectClause = projectFilter.length > 0 ? `AND ${projectFilter.join(' AND ')}` : '';

  if (mode === 'vector' || mode === 'both') {
    // Vector similarity search
    await initEmbeddings();
    const queryEmbedding = await generateEmbedding(query);

    const stmt = db.prepare(`
      SELECT
        e.id,
        e.project,
        e.timestamp,
        e.archive_path,
        e.line_start,
        e.line_end,
        e.compressed_tool_summary,
        SUBSTR(e.user_message, 1, 100) AS snippet_text,
        vec.distance
      FROM vec_exchanges AS vec
      JOIN exchanges AS e ON vec.id = e.id
      WHERE vec.embedding MATCH ?
        AND k = ?
        ${timeClause}
        ${projectClause}
      ORDER BY vec.distance ASC
    `);

    const vectorParams = [
      Buffer.from(new Float32Array(queryEmbedding).buffer),
      limit,
      ...timeFilterParams,
      ...(projects || [])
    ];

    results = stmt.all(...vectorParams);
  }

  if (mode === 'text' || mode === 'both') {
    // Text search
    const textStmt = db.prepare(`
      SELECT
        e.id,
        e.project,
        e.timestamp,
        e.archive_path,
        e.line_start,
        e.line_end,
        e.compressed_tool_summary,
        SUBSTR(e.user_message, 1, 100) AS snippet_text,
        0 as distance
      FROM exchanges AS e
      WHERE (e.user_message LIKE ? OR e.assistant_message LIKE ?)
        ${timeClause}
        ${projectClause}
      ORDER BY e.timestamp DESC
      LIMIT ?
    `);

    const textParams = [
      `%${query}%`,
      `%${query}%`,
      ...timeFilterParams,
      ...(projects || []),
      limit
    ];

    const textResults = textStmt.all(...textParams);

    if (mode === 'both') {
      // Merge and deduplicate by ID
      const seenIds = new Set(results.map(r => r.id));
      for (const textResult of textResults) {
        if (!seenIds.has((textResult as any).id)) {
          results.push(textResult);
        }
      }
    } else {
      results = textResults;
    }
  }

  db.close();

  // Map rows to CompactSearchResult
  let compactResults = results.map((row: any): CompactSearchResult => {
    // Create snippet from snippet_text (first 100 chars from SQL)
    const snippetText = row.snippet_text || '';
    const snippet = snippetText + (snippetText.length >= 100 ? '...' : '');

    return {
      id: row.id,
      project: row.project,
      timestamp: row.timestamp,
      archivePath: row.archive_path,
      lineStart: row.line_start,
      lineEnd: row.line_end,
      compressedToolSummary: row.compressed_tool_summary,
      similarity: mode === 'text' ? undefined : 1 - row.distance,
      snippet
    };
  });

  // Apply recency boost to vector results and re-sort by boosted similarity
  if (mode === 'vector' || mode === 'both') {
    // For vector results, apply recency boost
    compactResults = compactResults.map(result => {
      if (result.similarity !== undefined) {
        return {
          ...result,
          similarity: applyRecencyBoost(result.similarity, result.timestamp)
        };
      }
      return result;
    });

    // Re-sort by boosted similarity (highest first)
    compactResults.sort((a, b) => {
      const aSim = a.similarity ?? 0;
      const bSim = b.similarity ?? 0;
      return bSim - aSim;
    });
  }

  return compactResults;
}

export function formatResults(results: CompactSearchResult[]): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  let output = `Found ${results.length} relevant conversation${results.length > 1 ? 's' : ''}:\n\n`;

  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    const date = new Date(result.timestamp).toISOString().split('T')[0];
    const simPct = result.similarity !== undefined ? Math.round(result.similarity * 100) : null;

    // Header with match percentage
    output += `${index + 1}. [${result.project}, ${date}]`;
    if (simPct !== null) {
      output += ` - ${simPct}% match`;
    }
    output += '\n';

    // Show snippet
    output += `   "${result.snippet}"\n`;

    // Show tool usage if available
    if (result.compressedToolSummary) {
      output += `   Actions: ${result.compressedToolSummary}\n`;
    }

    // File information without metadata
    const lineRange = `${result.lineStart}-${result.lineEnd}`;
    output += `   Lines ${lineRange} in ${result.archivePath}\n\n`;
  }

  return output;
}

/**
 * @deprecated Multi-concept search is legacy since v6.0. Use single-concept search with filters instead.
 * @removal Version 7.0
 *
 * This function uses the old exchange-based search mechanism. The recommended approach is to use
 * `searchObservations()` with filter parameters (types, concepts, files) for better results and
 * performance.
 *
 * Example replacement:
 * - Old: searchMultipleConcepts(['auth', 'JWT', 'error'], { projects: ['myapp'] })
 * - New: searchObservations('auth JWT error', { concepts: ['auth', 'JWT', 'error'], projects: ['myapp'] })
 */
export async function searchMultipleConcepts(
  concepts: string[],
  options: Omit<SearchOptions, 'mode'> = {}
): Promise<CompactMultiConceptResult[]> {
  // Emit deprecation warning to stderr
  console.warn('[DEPRECATED] searchMultipleConcepts is legacy and will be removed in a future version.');
  console.warn('[DEPRECATED] Use searchObservations() with filter parameters instead.');
  console.warn('[DEPRECATED] Example: searchObservations("your query", { concepts: ["concept1", "concept2"] })');

  const { limit = 10, projects } = options;

  if (concepts.length === 0) {
    return [];
  }

  // Search for each concept independently
  const conceptResults = await Promise.all(
    concepts.map(concept => searchConversations(concept, { limit: limit * 5, mode: 'vector', after: options.after, before: options.before, projects }))
  );

  // Build map of conversation path -> array of results (one per concept)
  const conversationMap = new Map<string, Array<CompactSearchResult & { conceptIndex: number }>>();

  conceptResults.forEach((results, conceptIndex) => {
    results.forEach(result => {
      const key = result.archivePath;
      if (!conversationMap.has(key)) {
        conversationMap.set(key, []);
      }
      conversationMap.get(key)!.push({ ...result, conceptIndex });
    });
  });

  // Find conversations that match ALL concepts
  const multiConceptResults: CompactMultiConceptResult[] = [];

  for (const [archivePath, results] of conversationMap.entries()) {
    // Check if all concepts are represented
    const representedConcepts = new Set(results.map(r => r.conceptIndex));
    if (representedConcepts.size === concepts.length) {
      // All concepts found in this conversation
      const conceptSimilarities = concepts.map((_concept, index) => {
        const result = results.find(r => r.conceptIndex === index);
        return result?.similarity || 0;
      });

      const averageSimilarity = conceptSimilarities.reduce((sum, sim) => sum + sim, 0) / conceptSimilarities.length;

      // Use the first result's data (they're all from the same conversation)
      const firstResult = results[0];

      multiConceptResults.push({
        id: firstResult.id,
        project: firstResult.project,
        timestamp: firstResult.timestamp,
        archivePath: firstResult.archivePath,
        lineStart: firstResult.lineStart,
        lineEnd: firstResult.lineEnd,
        compressedToolSummary: firstResult.compressedToolSummary,
        snippet: firstResult.snippet,
        conceptSimilarities,
        averageSimilarity
      });
    }
  }

  // Sort by average similarity (highest first)
  multiConceptResults.sort((a, b) => b.averageSimilarity - a.averageSimilarity);

  // Apply limit
  return multiConceptResults.slice(0, limit);
}

export function formatMultiConceptResults(
  results: CompactMultiConceptResult[],
  concepts: string[]
): string {
  if (results.length === 0) {
    return `No conversations found matching all concepts: ${concepts.join(', ')}`;
  }

  let output = `Found ${results.length} conversation${results.length > 1 ? 's' : ''} matching all concepts [${concepts.join(' + ')}]:\n\n`;

  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    const date = new Date(result.timestamp).toISOString().split('T')[0];
    const avgPct = Math.round(result.averageSimilarity * 100);

    // Header with average match percentage
    output += `${index + 1}. [${result.project}, ${date}] - ${avgPct}% avg match\n`;

    // Show individual concept scores
    const scores = result.conceptSimilarities
      .map((sim, i) => `${concepts[i]}: ${Math.round(sim * 100)}%`)
      .join(', ');
    output += `   Concepts: ${scores}\n`;

    // Show snippet
    output += `   "${result.snippet}"\n`;

    // Show tool usage if available
    if (result.compressedToolSummary) {
      output += `   Actions: ${result.compressedToolSummary}\n`;
    }

    // File information without metadata
    const lineRange = `${result.lineStart}-${result.lineEnd}`;
    output += `   Lines ${lineRange} in ${result.archivePath}\n\n`;
  }

  return output;
}

// ============================================================================
// Observation-based search (Layer 1 of progressive disclosure)
// ============================================================================

export interface ObservationSearchOptions {
  limit?: number;
  mode?: 'vector' | 'text' | 'both';
  after?: string;  // ISO date string
  before?: string; // ISO date string
  projects?: string[]; // Filter by project names
  types?: string[]; // Filter by observation types (decision, bugfix, etc.)
  concepts?: string[]; // Filter by concepts
  files?: string[]; // Filter by files (read or modified)
}

export interface CompactObservationResult {
  id: string;
  sessionId: string;
  project: string;
  timestamp: string;
  type: string;
  title: string;
  subtitle?: string;
  facts: string[];
  concepts: string[];
  filesRead: string[];
  filesModified: string[];
  similarity?: number;
}

/**
 * Search observations using vector similarity, text matching, or both.
 * Returns compact observations (Layer 1 of progressive disclosure).
 */
export async function searchObservations(
  query: string,
  options: ObservationSearchOptions = {}
): Promise<CompactObservationResult[]> {
  const { limit = 10, mode = 'both', after, before, projects, types, concepts, files } = options;

  // Validate date parameters
  if (after) validateISODate(after, '--after');
  if (before) validateISODate(before, '--before');

  const db = initDatabase();

  let results: CompactObservationResult[] = [];

  // Build WHERE clauses
  const whereClauses: string[] = [];
  const whereParams: any[] = [];

  if (after) {
    whereClauses.push('o.timestamp >= ?');
    whereParams.push(after);
  }
  if (before) {
    whereClauses.push('o.timestamp <= ?');
    whereParams.push(before);
  }
  if (projects && projects.length > 0) {
    whereClauses.push(`o.project IN (${projects.map(() => '?').join(',')})`);
    whereParams.push(...projects);
  }
  if (types && types.length > 0) {
    whereClauses.push(`o.type IN (${types.map(() => '?').join(',')})`);
    whereParams.push(...types);
  }
  if (concepts && concepts.length > 0) {
    // Filter by JSON array contains
    whereClauses.push(`(
      SELECT COUNT(*) FROM json_each(o.concepts)
      WHERE json_each.value IN (${concepts.map(() => '?').join(',')})
    ) > 0`);
    whereParams.push(...concepts);
  }
  if (files && files.length > 0) {
    // Filter by files_read or files_modified
    whereClauses.push(`(
      SELECT COUNT(*) FROM json_each(o.files_read)
      WHERE json_each.value IN (${files.map(() => '?').join(',')})
    ) > 0 OR (
      SELECT COUNT(*) FROM json_each(o.files_modified)
      WHERE json_each.value IN (${files.map(() => '?').join(',')})
    ) > 0`);
    whereParams.push(...files, ...files);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  if (mode === 'vector' || mode === 'both') {
    // Vector similarity search using vec_observations
    await initEmbeddings();
    const queryEmbedding = await generateEmbedding(query);

    const stmt = db.prepare(`
      SELECT
        o.id,
        o.session_id as sessionId,
        o.project,
        o.timestamp,
        o.type,
        o.title,
        o.subtitle,
        o.facts,
        o.concepts,
        o.files_read as filesRead,
        o.files_modified as filesModified,
        v.distance
      FROM observations o
      INNER JOIN vec_observations v ON o.id = v.id
      ${whereClause}
      ORDER BY v.distance
      LIMIT ?
    `);

    const vectorResults = stmt.all(...whereParams, limit * 2) as any[];

    for (const row of vectorResults) {
      // Convert distance to similarity (1 - distance for cosine distance)
      const similarity = Math.max(0, 1 - row.distance);
      const boostedSimilarity = applyRecencyBoost(similarity, row.timestamp);

      results.push({
        id: row.id,
        sessionId: row.sessionId,
        project: row.project,
        timestamp: row.timestamp,
        type: row.type,
        title: row.title,
        subtitle: row.subtitle,
        facts: JSON.parse(row.facts),
        concepts: JSON.parse(row.concepts),
        filesRead: JSON.parse(row.filesRead),
        filesModified: JSON.parse(row.filesModified),
        similarity: boostedSimilarity
      });
    }
  }

  if (mode === 'text' || mode === 'both') {
    // Text-based search using LIKE
    // Use WHERE if no filters, otherwise AND
    const textWhereClause = whereClause ? `${whereClause}\n      AND (` : 'WHERE (';
    const textStmt = db.prepare(`
      SELECT
        o.id,
        o.session_id as sessionId,
        o.project,
        o.timestamp,
        o.type,
        o.title,
        o.subtitle,
        o.facts,
        o.concepts,
        o.files_read as filesRead,
        o.files_modified as filesModified
      FROM observations o
      ${textWhereClause}
        o.title LIKE ? OR
        o.subtitle LIKE ? OR
        o.narrative LIKE ?
      )
      ORDER BY o.timestamp DESC
      LIMIT ?
    `);

    const likeQuery = `%${query}%`;
    const textResults = textStmt.all(...whereParams, likeQuery, likeQuery, likeQuery, limit * 2) as any[];

    for (const row of textResults) {
      // Check if we already have this result from vector search
      const existing = results.find(r => r.id === row.id);
      if (existing) {
        continue;
      }

      results.push({
        id: row.id,
        sessionId: row.sessionId,
        project: row.project,
        timestamp: row.timestamp,
        type: row.type,
        title: row.title,
        subtitle: row.subtitle,
        facts: JSON.parse(row.facts),
        concepts: JSON.parse(row.concepts),
        filesRead: JSON.parse(row.filesRead),
        filesModified: JSON.parse(row.filesModified),
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
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Apply limit
  return results.slice(0, limit);
}

/**
 * Format observation search results as markdown.
 */
export function formatObservationResults(results: CompactObservationResult[]): string {
  if (results.length === 0) {
    return 'No observations found matching your query.';
  }

  let output = `Found ${results.length} observation${results.length > 1 ? 's' : ''}:\n\n`;

  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    const date = new Date(result.timestamp).toISOString().split('T')[0];
    const time = new Date(result.timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Header with similarity score if available
    if (result.similarity !== undefined) {
      const pct = Math.round(result.similarity * 100);
      output += `${index + 1}. [${result.project}, ${date} ${time}] - ${pct}% match - **${result.type}**: ${result.title}\n`;
    } else {
      output += `${index + 1}. [${result.project}, ${date} ${time}] - **${result.type}**: ${result.title}\n`;
    }

    // Show subtitle if available
    if (result.subtitle) {
      output += `   ${result.subtitle}\n`;
    }

    // Show facts
    if (result.facts.length > 0) {
      output += `   Facts: ${result.facts.map(f => `\`${f}\``).join(', ')}\n`;
    }

    // Show concepts
    if (result.concepts.length > 0) {
      output += `   Concepts: ${result.concepts.map(c => `\`${c}\``).join(', ')}\n`;
    }

    // Show files
    const allFiles = [...result.filesRead, ...result.filesModified];
    if (allFiles.length > 0) {
      const uniqueFiles = [...new Set(allFiles)];
      output += `   Files: ${uniqueFiles.join(', ')}\n`;
    }

    output += `\n`;
  }

  return output;
}
