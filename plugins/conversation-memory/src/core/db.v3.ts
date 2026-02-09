/**
 * V3 Database Schema
 *
 * Clean slate redesign with simplified architecture:
 * - pending_events: Temporary storage for tool events before LLM extraction
 * - observations: Long-term storage for extracted insights
 * - vec_observations: Vector embeddings for semantic search
 * - observations_fts: Full-text search index
 *
 * Removed tables (no migration):
 * - exchanges (use conversation-archive directly)
 * - vec_exchanges (no longer needed)
 * - tool_calls (no longer needed)
 * - session_summaries (moved to observations)
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as sqliteVec from 'sqlite-vec';
import { getDbPath } from './paths.js';

export interface PendingEventV3 {
  sessionId: string;
  project: string;
  toolName: string;
  compressed: string;
  timestamp: number;
  createdAt: number;
}

export interface ObservationV3 {
  title: string;
  content: string;
  project: string;
  sessionId?: string;
  timestamp: number;
  createdAt: number;
}

export interface ObservationResultV3 {
  id: number;
  title: string;
  content: string;
  project: string;
  sessionId: string | null;
  timestamp: number;
  createdAt: number;
}

export interface SearchOptionsV3 {
  project?: string;
  sessionId?: string;
  after?: number;
  before?: number;
  limit?: number;
  query?: string; // Full-text search query
}

/**
 * Initialize V3 database with new schema
 * Deletes old database file if it exists (clean slate)
 */
export function initDatabaseV3(): Database.Database {
  const dbPath = getDbPath();

  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Delete old database file for clean slate (only if not in-memory)
  if (dbPath !== ':memory:' && fs.existsSync(dbPath)) {
    console.log('Deleting old database file for V3 clean slate...');
    fs.unlinkSync(dbPath);
  }

  const db = new Database(dbPath);

  // Load sqlite-vec extension
  sqliteVec.load(db);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Create pending_events table
  db.exec(`
    CREATE TABLE pending_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      project TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      compressed TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Create observations table
  db.exec(`
    CREATE TABLE observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      project TEXT NOT NULL,
      session_id TEXT,
      timestamp INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Create vector table for observations
  // Note: Using id (as TEXT) to link with observations table
  db.exec(`
    CREATE VIRTUAL TABLE vec_observations USING vec0(
      id TEXT PRIMARY KEY,
      embedding float[768]
    )
  `);

  // Create full-text search table for observations
  db.exec(`
    CREATE VIRTUAL TABLE observations_fts USING fts5(title, content)
  `);

  // Create indexes for pending_events
  db.exec(`
    CREATE INDEX idx_pending_session ON pending_events(session_id)
  `);
  db.exec(`
    CREATE INDEX idx_pending_project ON pending_events(project)
  `);
  db.exec(`
    CREATE INDEX idx_pending_timestamp ON pending_events(timestamp)
  `);

  // Create indexes for observations
  db.exec(`
    CREATE INDEX idx_observations_project ON observations(project)
  `);
  db.exec(`
    CREATE INDEX idx_observations_session ON observations(session_id)
  `);
  db.exec(`
    CREATE INDEX idx_observations_timestamp ON observations(timestamp DESC)
  `);

  return db;
}

/**
 * Insert a pending event into the database
 */
export function insertPendingEventV3(
  db: Database.Database,
  event: PendingEventV3
): number {
  const stmt = db.prepare(`
    INSERT INTO pending_events (session_id, project, tool_name, compressed, timestamp, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    event.sessionId,
    event.project,
    event.toolName,
    event.compressed,
    event.timestamp,
    event.createdAt
  );

  return result.lastInsertRowid as number;
}

/**
 * Insert an observation into the database
 * Optionally includes vector embedding for semantic search
 */
export function insertObservationV3(
  db: Database.Database,
  observation: ObservationV3,
  embedding?: number[]
): number {
  // Insert into main table
  const stmt = db.prepare(`
    INSERT INTO observations (title, content, project, session_id, timestamp, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    observation.title,
    observation.content,
    observation.project,
    observation.sessionId ?? null,
    observation.timestamp,
    observation.createdAt
  );

  const rowid = result.lastInsertRowid as number;

  // Insert into vector table if embedding provided
  // Use the string id to link the tables
  if (embedding) {
    const vecStmt = db.prepare(`
      INSERT INTO vec_observations (id, embedding)
      VALUES (?, ?)
    `);
    vecStmt.run(String(rowid), Buffer.from(new Float32Array(embedding).buffer));
  }

  // Insert into FTS table
  const ftsStmt = db.prepare(`
    INSERT INTO observations_fts (rowid, title, content)
    VALUES (?, ?, ?)
  `);
  ftsStmt.run(rowid, observation.title, observation.content);

  return rowid;
}

/**
 * Get all pending events for a session (no limit).
 * Used by Stop hook for batch extraction.
 */
export function getAllPendingEventsV3(
  db: Database.Database,
  sessionId: string
): Array<PendingEventV3 & { id: number }> {
  const stmt = db.prepare(`
    SELECT id, session_id as sessionId, project, tool_name as toolName, compressed, timestamp, created_at as createdAt
    FROM pending_events
    WHERE session_id = ?
    ORDER BY created_at ASC
  `);

  return stmt.all(sessionId) as Array<PendingEventV3 & { id: number }>;
}

/**
 * Get pending events for a session
 */
export function getPendingEventsV3(
  db: Database.Database,
  sessionId: string,
  limit: number = 10
): Array<PendingEventV3 & { id: number }> {
  const stmt = db.prepare(`
    SELECT id, session_id as sessionId, project, tool_name as toolName, compressed, timestamp, created_at as createdAt
    FROM pending_events
    WHERE session_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `);

  return stmt.all(sessionId, limit) as Array<PendingEventV3 & { id: number }>;
}

/**
 * Delete old pending events
 * If sessionId is provided, only deletes events for that session
 */
export function deleteOldPendingEventsV3(
  db: Database.Database,
  beforeTimestamp: number,
  sessionId?: string
): number {
  let sql = 'DELETE FROM pending_events WHERE created_at < ?';
  const params: any[] = [beforeTimestamp];

  if (sessionId) {
    sql += ' AND session_id = ?';
    params.push(sessionId);
  }

  const stmt = db.prepare(sql);
  const result = stmt.run(...params);

  return result.changes;
}

/**
 * Search observations with filters
 */
export function searchObservationsV3(
  db: Database.Database,
  options: SearchOptionsV3 = {}
): ObservationResultV3[] {
  const { project, sessionId, after, before, limit = 100, query } = options;

  let sql: string;
  const params: any[] = [];

  if (query) {
    // Use full-text search
    sql = `
      SELECT o.id, o.title, o.content, o.project, o.session_id as sessionId, o.timestamp, o.created_at as createdAt
      FROM observations o
      INNER JOIN observations_fts fts ON o.id = fts.rowid
      WHERE observations_fts MATCH ?
    `;
    params.push(query);

    if (project) {
      sql += ' AND o.project = ?';
      params.push(project);
    }

    if (sessionId) {
      sql += ' AND o.session_id = ?';
      params.push(sessionId);
    }

    if (after) {
      sql += ' AND o.timestamp >= ?';
      params.push(after);
    }

    if (before) {
      sql += ' AND o.timestamp <= ?';
      params.push(before);
    }

    sql += ' ORDER BY o.timestamp DESC LIMIT ?';
    params.push(limit);
  } else {
    // Regular query without full-text search
    sql = `
      SELECT id, title, content, project, session_id as sessionId, timestamp, created_at as createdAt
      FROM observations
      WHERE 1=1
    `;

    if (project) {
      sql += ' AND project = ?';
      params.push(project);
    }

    if (sessionId) {
      sql += ' AND session_id = ?';
      params.push(sessionId);
    }

    if (after) {
      sql += ' AND timestamp >= ?';
      params.push(after);
    }

    if (before) {
      sql += ' AND timestamp <= ?';
      params.push(before);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);
  }

  const stmt = db.prepare(sql);
  return stmt.all(...params) as ObservationResultV3[];
}

/**
 * Get a single observation by ID
 */
export function getObservationV3(
  db: Database.Database,
  id: number
): ObservationResultV3 | null {
  const stmt = db.prepare(`
    SELECT id, title, content, project, session_id as sessionId, timestamp, created_at as createdAt
    FROM observations
    WHERE id = ?
  `);

  const result = stmt.get(id) as ObservationResultV3 | undefined;
  return result ?? null;
}

/**
 * Delete an observation by ID
 */
export function deleteObservationV3(
  db: Database.Database,
  id: number
): boolean {
  const idStr = String(id);

  // Delete from vector table
  db.prepare('DELETE FROM vec_observations WHERE id = ?').run(idStr);

  // Delete from FTS table
  db.prepare('DELETE FROM observations_fts WHERE rowid = ?').run(id);

  // Delete from main table
  const stmt = db.prepare('DELETE FROM observations WHERE id = ?');
  const result = stmt.run(id);

  return result.changes > 0;
}

/**
 * Get count of observations by project
 */
export function getObservationCountV3(
  db: Database.Database,
  project?: string
): number {
  let sql = 'SELECT COUNT(*) as count FROM observations';
  const params: any[] = [];

  if (project) {
    sql += ' WHERE project = ?';
    params.push(project);
  }

  const stmt = db.prepare(sql);
  const result = stmt.get(...params) as { count: number };

  return result.count;
}

/**
 * Get count of pending events by session
 */
export function getPendingEventCountV3(
  db: Database.Database,
  sessionId?: string
): number {
  let sql = 'SELECT COUNT(*) as count FROM pending_events';
  const params: any[] = [];

  if (sessionId) {
    sql += ' WHERE session_id = ?';
    params.push(sessionId);
  }

  const stmt = db.prepare(sql);
  const result = stmt.get(...params) as { count: number };

  return result.count;
}
