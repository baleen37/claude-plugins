#!/usr/bin/env node
/**
 * V2 to V3 Migration Helper Script
 *
 * This script helps users migrate from v2 to v3 database schema.
 * Due to significant schema differences, automated data migration is not supported.
 *
 * What this script does:
 * 1. Detect if a v2 database exists
 * 2. Validate v2 schema structure
 * 3. Provide manual migration instructions
 *
 * What this script does NOT do:
 * - Migrate data automatically (schema changes are too significant)
 * - Preserve v2 data in v3 format
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import readline from 'readline';

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function getDbPath() {
  if (process.env.CONVERSATION_MEMORY_DB_PATH) {
    return process.env.CONVERSATION_MEMORY_DB_PATH;
  }
  return path.join(os.homedir(), '.config', 'conversation-memory', 'conversation-index', 'conversations.db');
}

function getBackupPath() {
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  const base = path.basename(dbPath, '.db');
  return path.join(dir, `${base}.v2.backup.db`);
}

/**
 * Check if database file exists
 */
function databaseExists(dbPath) {
  return fs.existsSync(dbPath);
}

/**
 * Get list of tables in the database
 */
function getTables(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  return new Set(tables.map(t => t.name));
}

/**
 * Detect if database has v2 schema
 */
function isV2Schema(tableNames) {
  // V2 schema has these tables
  const v2Tables = ['exchanges', 'session_summaries'];
  return v2Tables.every(t => tableNames.has(t));
}

/**
 * Detect if database has v3 schema
 */
function isV3Schema(tableNames) {
  // V3 schema has these tables
  const v3Tables = ['pending_events', 'observations', 'vec_observations'];
  return v3Tables.every(t => tableNames.has(t));
}

/**
 * Get counts from v2 tables
 */
function getV2Stats(db) {
  try {
    const exchangeCount = db.prepare('SELECT COUNT(*) as count FROM exchanges').get()?.count ?? 0;
    const summaryCount = db.prepare('SELECT COUNT(*) as count FROM session_summaries').get()?.count ?? 0;
    return { exchangeCount, summaryCount };
  } catch {
    return { exchangeCount: 0, summaryCount: 0 };
  }
}

/**
 * Wait for user to press Enter
 */
function waitForConfirmation(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Display manual migration instructions
 */
function displayMigrationInstructions(dbPath, backupPath, stats) {
  log('\n' + '='.repeat(70), colors.cyan);
  log('  V2 to V3 Manual Migration Instructions', colors.bold + colors.cyan);
  log('='.repeat(70) + '\n', colors.cyan);

  log('V2 Database Statistics:', colors.yellow);
  log(`  - Exchanges: ${stats.exchangeCount} records`);
  log(`  - Session Summaries: ${stats.summaryCount} records`);
  log(`  - Database location: ${dbPath}\n`);

  log('IMPORTANT: V3 uses a completely different schema that is incompatible with v2.', colors.red);
  log('Automated migration is not supported due to fundamental architecture changes.\n', colors.red);

  log('Schema Changes:', colors.yellow);
  log('  V2 (deprecated):');
  log('    - exchanges table (exchange-based search)');
  log('    - vec_exchanges table (vector embeddings for exchanges)');
  log('    - session_summaries table (session-level summaries)');
  log('  V3 (current):');
  log('    - observations table (simplified observation model)');
  log('    - vec_observations table (vector embeddings for observations)');
  log('    - pending_events table (temporary event storage)\n');

  log('Migration Steps:', colors.green);
  log('  1. Backup your v2 database (optional but recommended):');
  log(`     cp "${dbPath}" "${backupPath}"\n`, colors.cyan);

  log('  2. Remove the v2 database:');
  log(`     rm "${dbPath}"\n`, colors.cyan);

  log('  3. Rebuild and restart:');
  log('     cd plugins/conversation-memory', colors.cyan);
  log('     npm run build', colors.cyan);
  log('     # Restart Claude Code\n');

  log('  4. V3 will create a fresh database automatically on next session start.\n');

  log('Data Preservation Notes:', colors.yellow);
  log('  - v2 conversation archives in ~/.config/conversation-memory/conversation-archive/');
  log('    are NOT affected and remain available for manual reference.');
  log('  - v3 will index new conversations going forward.');
  log('  - Historical data from v2 cannot be automatically converted to v3 format.\n');

  log('Alternative: Keep v2 Database Read-Only', colors.yellow);
  log('  If you need to reference v2 data, you can:');
  log(`  1. Rename instead of delete: mv "${dbPath}" "${backupPath}"`);
  log('  2. Use sqlite3 CLI to query the backup when needed:');
  log(`     sqlite3 "${backupPath}" "SELECT * FROM exchanges LIMIT 10;"\n`);
}

/**
 * Main function
 */
async function main() {
  log('\n' + '='.repeat(70), colors.cyan);
  log('  Conversation Memory: V2 to V3 Migration Helper', colors.bold + colors.cyan);
  log('='.repeat(70) + '\n', colors.cyan);

  log('EXPERIMENTAL: This migration helper is provided for advanced users.', colors.yellow);
  log('Please ensure you have backed up any important data before proceeding.\n', colors.yellow);

  await waitForConfirmation('Press Enter to continue (Ctrl+C to cancel)...');

  const dbPath = getDbPath();
  const backupPath = getBackupPath();

  log(`Database path: ${dbPath}\n`);

  // Check if database exists
  if (!databaseExists(dbPath)) {
    log('No existing database found.', colors.green);
    log('V3 will create a fresh database automatically when you start a new session.\n');
    process.exit(0);
  }

  // Open database and check schema
  let db;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch (error) {
    log(`Error opening database: ${error.message}`, colors.red);
    log('The database file may be corrupted or locked.\n');
    process.exit(1);
  }

  const tableNames = getTables(db);

  // Check what schema version we have
  const hasV2 = isV2Schema(tableNames);
  const hasV3 = isV3Schema(tableNames);

  if (hasV3 && !hasV2) {
    log('Your database is already using the V3 schema.', colors.green);
    log('No migration needed.\n');
    db.close();
    process.exit(0);
  }

  if (!hasV2 && !hasV3) {
    log('Unknown database schema detected.', colors.yellow);
    log(`Tables found: ${Array.from(tableNames).join(', ') || 'none'}`);
    log('This may be a corrupted or empty database.\n');
    log('Recommended action: Remove the database and let V3 create a fresh one.');
    log(`  rm "${dbPath}"\n`);
    db.close();
    process.exit(1);
  }

  // We have a v2 database (possibly with some v3 tables from partial migration)
  if (hasV2) {
    log('V2 database detected!', colors.yellow);
    log('This database uses the old exchange-based schema.\n');

    // Get stats before showing instructions
    const stats = getV2Stats(db);
    db.close();

    // Show migration instructions
    displayMigrationInstructions(dbPath, backupPath, stats);
  } else {
    db.close();
  }
}

// Run main function
main().catch(error => {
  log(`\nUnexpected error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
