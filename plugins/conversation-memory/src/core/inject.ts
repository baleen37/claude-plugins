import Database from 'better-sqlite3';
import { initDatabase } from './db.js';
import type { CompactObservation } from './types.js';

interface InjectOptions {
  days?: number;
  limit?: number;
  sessionIds?: string[];
}

interface GroupedObservations {
  date: string;
  observations: Array<CompactObservation & { time: string }>;
}

/**
 * Get observations for context injection.
 * Returns observations from the last N days, grouped by date.
 */
export function getObservationsForInjection(
  db: Database.Database,
  options: InjectOptions = {}
): GroupedObservations[] {
  const { days = 7, limit = 30 } = options;

  // Calculate timestamp for N days ago
  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

  // Get observations
  const stmt = db.prepare(`
    SELECT id, session_id as sessionId, project, timestamp, type, title, subtitle,
           facts, concepts, files_read as filesRead, files_modified as filesModified
    FROM observations
    WHERE timestamp >= ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const rows = stmt.all(cutoffTime, limit) as any[];

  // Parse JSON fields and group by date
  const observationsByDate = new Map<string, Array<CompactObservation & { time: string }>>();

  for (const row of rows) {
    const date = new Date(row.timestamp).toLocaleDateString('en-CA', { // YYYY-MM-DD format
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');

    const time = new Date(row.timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (!observationsByDate.has(date)) {
      observationsByDate.set(date, []);
    }

    observationsByDate.get(date)!.push({
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
      time
    });
  }

  // Convert to array and sort by date (newest first)
  return Array.from(observationsByDate.entries())
    .map(([date, observations]) => ({ date, observations }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Format observations as a compact markdown table for injection.
 * This is Layer 1 of progressive disclosure (~30 tokens).
 */
export function formatInjectContext(
  grouped: GroupedObservations[],
  projectName: string
): string {
  if (grouped.length === 0) {
    return `# [${projectName}] recent context (conversation-memory)

No recent observations found. Use \`search()\` to find past work.
`;
  }

  const totalObs = grouped.reduce((sum, g) => sum + g.observations.length, 0);
  const estimatedTokens = totalObs * 30; // Rough estimate

  let output = `# [${projectName}] recent context (conversation-memory)

**Tools**: \`search(query)\` find past work | \`get_observations(ids)\` details | \`read(path)\` full conversation
**Stats**: ${totalObs} observations | ~${estimatedTokens}t index | ~${Math.round(estimatedTokens * 15)}t of past work
`;

  for (const group of grouped) {
    output += `\n### ${group.date}\n\n`;
    output += `| # | Time | Type | Title | Files |\n`;
    output += `|---|------|------|-------|-------|\n`;

    for (let i = 0; i < group.observations.length; i++) {
      const obs = group.observations[i];
      const files = obs.filesModified.join(', ') || '-';
      output += `| ${i + 1} | ${obs.time} | ${obs.type} | ${obs.title} | ${files} |\n`;
    }
  }

  // Example IDs for demonstration
  const exampleIds = grouped[0]?.observations.slice(0, 2).map(o => o.id).join('", "') || '';
  if (exampleIds) {
    output += `\n---\nAccess full details: \`get_observations(["${exampleIds}"])\`\n`;
  }

  return output;
}

/**
 * Get and format observations for SessionStart injection.
 */
export function getInjectContext(projectName: string, options?: InjectOptions): string {
  const db = initDatabase();
  try {
    const grouped = getObservationsForInjection(db, options);
    return formatInjectContext(grouped, projectName);
  } finally {
    db.close();
  }
}
