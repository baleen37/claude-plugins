import Database from 'better-sqlite3';
import { initDatabase } from './db.js';
import { initEmbeddings, generateEmbedding } from './embeddings.js';
import { SearchResult, ConversationExchange, MultiConceptResult, CompactSearchResult, CompactMultiConceptResult } from './types.js';

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

export async function searchMultipleConcepts(
  concepts: string[],
  options: Omit<SearchOptions, 'mode'> = {}
): Promise<CompactMultiConceptResult[]> {
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
