import { verifyIndex, repairIndex } from '../core/verify.js';
import { indexSession, indexUnprocessed, indexConversations, recomputeToolSummaries } from '../core/indexer.js';
import { syncConversations } from '../core/sync.js';
import { getDbPath, getArchiveDir } from '../core/paths.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const command = process.argv[2];

// Show help if no command or --help
if (!command || command === '--help' || command === '-h') {
  console.log(`
Conversation Memory CLI - Persistent semantic search for Claude Code sessions

USAGE:
  conversation-memory <command> [options]

COMMANDS:
  sync                Copy new conversations from ~/.claude/projects to archive
  index-all           Re-index all conversations (slow, use with caution)
  index-session <id>  Index a specific session by ID
  index-cleanup       Index only unprocessed conversations
  recompute-summaries Recompute compressed tool summaries for existing indexed data
  verify              Check index health for issues
  repair              Fix detected issues from verify
  rebuild             Delete database and re-index everything
  inject              Inject recent context into session (for SessionStart hook)
  observe             Handle PostToolUse hook (internal)
  observer            Control observer background process

OPTIONS:
  --concurrency, -c N  Parallelism for summaries/embeddings (1-16, default: 1)
  --no-summaries       Skip AI summarization
  --summarize          Request session summary (for Stop hook)

EXAMPLES:
  # Sync new conversations
  conversation-memory sync

  # Sync with parallel summarization
  conversation-memory sync --concurrency 4

  # Index a specific session
  conversation-memory index-session 2025-02-06-123456

  # Verify index health
  conversation-memory verify

  # Repair issues
  conversation-memory repair --repair

  # Recompute tool summaries for existing data
  conversation-memory recompute-summaries

  # Rebuild entire index
  conversation-memory rebuild --concurrency 8

  # Observer control
  conversation-memory observer start
  conversation-memory observer status
  conversation-memory observer stop

ENVIRONMENT VARIABLES:
  CONVERSATION_MEMORY_CONFIG_DIR   Override config directory
  CONVERSATION_MEMORY_DB_PATH      Override database path
  CONVERSATION_SEARCH_EXCLUDE_PROJECTS  Comma-separated projects to exclude

For more information, visit: https://github.com/wooto/claude-plugins
`);
  process.exit(0);
}

// Ensure dependencies are installed before running any command
async function ensureDependencies() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
  const nodeModulesPath = path.join(pluginRoot, 'node_modules');

  if (!fs.existsSync(nodeModulesPath)) {
    console.error('[conversation-memory] Installing dependencies...');
    try {
      execSync('npm install --silent', {
        cwd: pluginRoot,
        stdio: 'inherit'
      });
      console.error('[conversation-memory] Dependencies installed.');
    } catch (error) {
      console.error('[conversation-memory] Failed to install dependencies:', error);
      throw error;
    }
  }
}

// Parse --concurrency flag from remaining args
function getConcurrency(): number {
  const concurrencyIndex = process.argv.findIndex(arg => arg === '--concurrency' || arg === '-c');
  if (concurrencyIndex !== -1 && process.argv[concurrencyIndex + 1]) {
    const value = parseInt(process.argv[concurrencyIndex + 1], 10);
    if (value >= 1 && value <= 16) return value;
  }
  return 1; // default
}

// Parse --no-summaries flag
function getNoSummaries(): boolean {
  return process.argv.includes('--no-summaries');
}

const concurrency = getConcurrency();
const noSummaries = getNoSummaries();

async function main() {
  try {
    // Ensure dependencies are installed (모든 명령 실행 전)
    await ensureDependencies();

    switch (command) {
      case 'inject':
        // Inject command - handle directly without dependency check for speed
        await import('./inject-cli.js');
        break;

      case 'observe':
      case 'observer':
      case 'observer-run':
        // Observer commands - handle directly without dependency check for speed
        await import('./observer-cli.js');
        break;

      case 'index-session':
        const sessionId = process.argv[3];
        if (!sessionId) {
          console.error('Usage: index-cli index-session <session-id>');
          process.exit(1);
        }
        await indexSession(sessionId, concurrency, noSummaries);
        break;

      case 'index-cleanup':
        await indexUnprocessed(concurrency, noSummaries);
        break;

      case 'recompute-summaries': {
        const db = await import('../core/db.js').then(m => m.initDatabase());
        try {
          const count = await recomputeToolSummaries(db);
          console.log(`Recomputed summaries for ${count} exchanges`);
        } finally {
          db.close();
        }
        break;
      }

      case 'sync':
        const syncSourceDir = path.join(os.homedir(), '.claude', 'projects');
        const syncDestDir = getArchiveDir();
        console.log('Syncing conversations...');
        const syncResult = await syncConversations(syncSourceDir, syncDestDir, { skipSummaries: noSummaries });
        console.log(`\nSync complete!`);
        console.log(`  Copied: ${syncResult.copied}`);
        console.log(`  Skipped: ${syncResult.skipped}`);
        console.log(`  Indexed: ${syncResult.indexed}`);
        console.log(`  Summarized: ${syncResult.summarized}`);
        if (syncResult.errors.length > 0) {
          console.log(`\nErrors: ${syncResult.errors.length}`);
          syncResult.errors.forEach(err => console.log(`  ${err.file}: ${err.error}`));
        }
        break;

      case 'verify':
        console.log('Verifying conversation index...');
        const issues = await verifyIndex();

        console.log('\n=== Verification Results ===');
        console.log(`Missing summaries: ${issues.missing.length}`);
        console.log(`Orphaned entries: ${issues.orphaned.length}`);
        console.log(`Outdated files: ${issues.outdated.length}`);
        console.log(`Corrupted files: ${issues.corrupted.length}`);

        if (issues.missing.length > 0) {
          console.log('\nMissing summaries:');
          issues.missing.forEach(m => console.log(`  ${m.path}`));
        }

        if (issues.missing.length + issues.orphaned.length + issues.outdated.length + issues.corrupted.length > 0) {
          console.log('\nRun with --repair to fix these issues.');
          process.exit(1);
        } else {
          console.log('\n✅ Index is healthy!');
        }
        break;

      case 'repair':
        console.log('Verifying conversation index...');
        const repairIssues = await verifyIndex();

        if (repairIssues.missing.length + repairIssues.orphaned.length + repairIssues.outdated.length > 0) {
          await repairIndex(repairIssues);
        } else {
          console.log('✅ No issues to repair!');
        }
        break;

      case 'rebuild':
        console.log('Rebuilding entire index...');

        // Delete database
        const dbPath = getDbPath();
        if (fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
          console.log('Deleted existing database');
        }

        // Delete all summary files
        const archiveDir = getArchiveDir();
        if (fs.existsSync(archiveDir)) {
          const projects = fs.readdirSync(archiveDir);
          for (const project of projects) {
            const projectPath = path.join(archiveDir, project);
            if (!fs.statSync(projectPath).isDirectory()) continue;

            const summaries = fs.readdirSync(projectPath).filter(f => f.endsWith('-summary.txt'));
            for (const summary of summaries) {
              fs.unlinkSync(path.join(projectPath, summary));
            }
          }
          console.log('Deleted all summary files');
        }

        // Re-index everything
        console.log('Re-indexing all conversations...');
        await indexConversations(undefined, undefined, concurrency, noSummaries);
        break;

      case 'index-all':
      default:
        await indexConversations(undefined, undefined, concurrency, noSummaries);
        break;
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
